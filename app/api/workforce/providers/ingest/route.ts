import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 128 * 1024;
const MAX_CANDIDATES = 50;

type IncomingCandidate = {
  source_candidate_id?: unknown;
  display_name?: unknown;
  profile_url?: unknown;
  location_text?: unknown;
  summary?: unknown;
  skills?: unknown;
};

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function safeProfileUrl(value: unknown): string | null {
  const raw = clean(value, 2048);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function safeSkills(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.slice(0, 40).map((item) => clean(item, 100)).filter(Boolean))];
}

function validSecret(received: string, expected: string): boolean {
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Trusted provider-to-server ingestion endpoint. Call only from a server-side
 * adapter that has explicit permission to use the configured source.
 * Never expose WORKFORCE_INGESTION_SECRET in browser code.
 */
export async function POST(request: Request) {
  const expectedSecret = process.env.WORKFORCE_INGESTION_SECRET ?? "";
  const receivedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (expectedSecret.length < 32 || !validSecret(receivedSecret, expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized ingestion request." }, { status: 401 });
  }

  const allowedSources = new Set(
    (process.env.WORKFORCE_APPROVED_SOURCE_IDS ?? "")
      .split(",")
      .map((source) => source.trim())
      .filter(Boolean)
  );
  if (allowedSources.size === 0) {
    return NextResponse.json({ error: "No approved workforce source IDs are configured." }, { status: 503 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body exceeds the 128 KB limit." }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request body exceeds the 128 KB limit." }, { status: 413 });
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "A JSON ingestion object is required." }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const vacancyId = clean(body.vacancy_id, 36);
  const sourceId = clean(body.source_id, 160);
  const authorizationReference = clean(body.authorization_reference, 500);
  if (!UUID.test(vacancyId) || !sourceId || !allowedSources.has(sourceId)) {
    return NextResponse.json({ error: "Vacancy ID or approved source ID is invalid." }, { status: 400 });
  }
  if (!Array.isArray(body.candidates) || body.candidates.length < 1 || body.candidates.length > MAX_CANDIDATES) {
    return NextResponse.json({ error: "Provide between 1 and 50 candidates per ingestion request." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data: vacancy, error: vacancyError } = await admin
      .from("workforce_vacancies")
      .select("id,organization_id,title,status,processing_authorized,authorization_reference")
      .eq("id", vacancyId)
      .maybeSingle();

    if (vacancyError) {
      console.error("workforce_ingestion_vacancy_lookup_failed", vacancyError.code);
      return NextResponse.json({ error: "Workforce database is unavailable." }, { status: 503 });
    }
    if (!vacancy) return NextResponse.json({ error: "Vacancy not found." }, { status: 404 });
    if (vacancy.status !== "open" || vacancy.processing_authorized !== true) {
      return NextResponse.json({ error: "Vacancy must be open and authorized before candidate ingestion." }, { status: 409 });
    }
    if (!authorizationReference || authorizationReference !== vacancy.authorization_reference) {
      return NextResponse.json({ error: "The ingestion authorization reference does not match the vacancy record." }, { status: 403 });
    }

    const normalized: Array<Record<string, unknown>> = [];
    const seen = new Set<string>();

    for (const item of body.candidates as IncomingCandidate[]) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const sourceCandidateId = clean(item.source_candidate_id, 240);
      if (!sourceCandidateId || seen.has(sourceCandidateId)) continue;
      seen.add(sourceCandidateId);
      normalized.push({
        source_candidate_id: sourceCandidateId,
        display_name: clean(item.display_name, 200) || null,
        profile_url: safeProfileUrl(item.profile_url),
        location_text: clean(item.location_text, 240) || null,
        job_relevant_summary: clean(item.summary, 1200) || null,
        job_relevant_skills: safeSkills(item.skills),
      });
    }

    if (normalized.length === 0) {
      return NextResponse.json({ error: "No candidates with valid source_candidate_id values were supplied." }, { status: 400 });
    }

    // The database RPC writes the leads and matching audit events atomically.
    // If either operation fails, the transaction rolls back both.
    const { data, error: ingestionError } = await admin.rpc("ingest_workforce_candidate_leads", {
      p_vacancy_id: vacancy.id,
      p_source_id: sourceId,
      p_authorization_reference: authorizationReference,
      p_candidates: normalized,
    });

    if (ingestionError || !data || typeof data !== "object") {
      console.error("workforce_candidate_atomic_ingestion_failed", ingestionError?.code);
      if (ingestionError?.code === "P0002") {
        return NextResponse.json({ error: "Vacancy not found." }, { status: 404 });
      }
      if (ingestionError?.code === "42501") {
        return NextResponse.json({ error: "The ingestion authorization reference could not be verified." }, { status: 403 });
      }
      if (ingestionError?.code === "22023") {
        return NextResponse.json({ error: "The vacancy is not eligible for ingestion or the candidate batch is invalid." }, { status: 409 });
      }
      return NextResponse.json({ error: "Candidate ingestion failed. Confirm the atomic ingestion migration is applied." }, { status: 503 });
    }

    const result = data as { count?: number; candidates?: unknown[]; audit?: string };
    return NextResponse.json({
      success: true,
      count: result.count ?? 0,
      candidates: result.candidates ?? [],
      audit: result.audit ?? "recorded_atomically",
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Workforce ingestion is not configured or could not be completed." }, { status: 503 });
  }
}
