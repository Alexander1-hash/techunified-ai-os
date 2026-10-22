import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  CENTRAL_AUDIT_LIMITS,
  validateCentralAuditInput,
} from "@/lib/market-intelligence/centralized-audit";

export const dynamic = "force-dynamic";

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null };
  return { supabase, user };
}

export async function GET(request: Request) {
  let auth;
  try { auth = await authenticatedClient(); }
  catch {
    return NextResponse.json({ error: "Audit storage is not configured." }, { status: 503 });
  }
  if (!auth.user) return NextResponse.json({ error: "Sign in to access your audit events." }, { status: 401 });

  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? 50);
  const limit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), CENTRAL_AUDIT_LIMITS.listLimit) : 50;
  let query = auth.supabase.from("intelligence_audit_events")
    .select("id,user_id,event_type,source,severity,summary,details,correlation_id,created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  const eventType = url.searchParams.get("eventType");
  if (eventType) query = query.eq("event_type", eventType);
  const { data, error } = await query;
  if (error) {
    return NextResponse.json({
      error: "Could not read centralized audit events. Apply the audit-events migration and verify Supabase configuration.",
      code: error.code ?? "AUDIT_STORAGE_UNAVAILABLE",
    }, { status: 503 });
  }
  return NextResponse.json({ success: true, storage: "supabase-user-scoped", events: data ?? [], limit });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > CENTRAL_AUDIT_LIMITS.requestBytes) {
    return NextResponse.json({ error: "Audit event request exceeds 16 KiB." }, { status: 413 });
  }

  let rawBody: string;
  try { rawBody = await request.text(); }
  catch { return NextResponse.json({ error: "Could not read request body." }, { status: 400 }); }
  if (new TextEncoder().encode(rawBody).byteLength > CENTRAL_AUDIT_LIMITS.requestBytes) {
    return NextResponse.json({ error: "Audit event request exceeds 16 KiB." }, { status: 413 });
  }

  let body: unknown;
  try { body = JSON.parse(rawBody); }
  catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const validation = validateCentralAuditInput(body);
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });

  let auth;
  try { auth = await authenticatedClient(); }
  catch {
    return NextResponse.json({ error: "Audit storage is not configured." }, { status: 503 });
  }
  if (!auth.user) return NextResponse.json({ error: "Sign in to append an audit event." }, { status: 401 });

  const event = validation.value;
  const { data, error } = await auth.supabase.from("intelligence_audit_events").insert({
    user_id: auth.user.id,
    event_type: event.eventType,
    source: event.source,
    severity: event.severity,
    summary: event.summary,
    details: event.details ?? {},
    correlation_id: event.correlationId ?? null,
  }).select("id,user_id,event_type,source,severity,summary,details,correlation_id,created_at").single();

  if (error) {
    return NextResponse.json({
      error: "Could not persist audit event. Apply the audit-events migration and verify Supabase configuration.",
      code: error.code ?? "AUDIT_STORAGE_UNAVAILABLE",
    }, { status: 503 });
  }
  return NextResponse.json({ success: true, storage: "supabase-user-scoped", event: data }, { status: 201 });
}
