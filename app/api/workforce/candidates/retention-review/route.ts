import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/repositories/profile";

export const dynamic = "force-dynamic";

function clean(value: unknown, max: number): string {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max)
    : "";
}

export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };
  try {
    const supabase = await createClient();
    const { profile } = await getCurrentProfile(supabase);
    if (!profile?.id || !profile.organization_id) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401, headers });
    }
    if (!["owner", "admin", "organization_admin", "recruiter", "hiring_manager"].includes(profile.role)) {
      return NextResponse.json({ error: "Your account role does not have permission to review candidate retention." }, { status: 403, headers });
    }

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await request.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return NextResponse.json({ error: "A retention review decision is required." }, { status: 400, headers });
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400, headers });
    }

    const candidateId = clean(body.candidate_id, 80);
    const reason = clean(body.reason, 1000);
    const interval = Number(body.review_interval_days);
    if (!candidateId || reason.length < 3 || ![30, 60, 90, 180].includes(interval)) {
      return NextResponse.json({
        error: "Provide a candidate ID, a documented retention reason, and a review interval of 30, 60, 90, or 180 days.",
      }, { status: 400, headers });
    }

    const { data: candidate, error: candidateError } = await supabase
      .from("workforce_candidate_leads")
      .select("id,vacancy_id")
      .eq("id", candidateId)
      .eq("organization_id", profile.organization_id)
      .maybeSingle();
    if (candidateError) {
      console.error("workforce_retention_candidate_lookup_failed", candidateError.code);
      return NextResponse.json({ error: "Unable to verify candidate lead. Confirm the workforce migrations are applied." }, { status: 503, headers });
    }
    if (!candidate) return NextResponse.json({ error: "Candidate lead not found in your organization." }, { status: 404, headers });

    const { data, error } = await supabase.rpc("review_workforce_candidate_retention", {
      p_candidate_id: candidateId,
      p_reason: reason,
      p_review_interval_days: interval,
    });
    if (error) {
      console.error("workforce_retention_review_rpc_failed", error.code);
      if (error.code === "P0002") return NextResponse.json({ error: "Candidate lead not found in your organization." }, { status: 404, headers });
      if (error.code === "42501") return NextResponse.json({ error: "Your organization access could not be verified." }, { status: 403, headers });
      if (error.code === "22023") return NextResponse.json({ error: "Provide a valid review reason and interval." }, { status: 400, headers });
      return NextResponse.json({ error: "Unable to record retention review. Confirm migration 20261011170000_workforce_retention_review.sql has been applied." }, { status: 503, headers });
    }

    const reviewed = Array.isArray(data) ? data[0] : data;
    if (!reviewed) return NextResponse.json({ error: "Retention review was not recorded." }, { status: 503, headers });
    return NextResponse.json({ success: true, review: reviewed, audit: "recorded_atomically" }, { headers });
  } catch {
    return NextResponse.json({ error: "Unable to record candidate retention review." }, { status: 500, headers });
  }
}
