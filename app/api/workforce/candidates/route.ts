import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/repositories/profile";
import { createAdminClient } from "@/lib/supabase/admin";

const REVIEW_STATUSES = ["new", "reviewing", "shortlisted", "not_progressing", "withdrawn"] as const;
type ReviewStatus = (typeof REVIEW_STATUSES)[number];

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "";
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { profile } = await getCurrentProfile(supabase);
    if (!profile?.organization_id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const vacancyId = new URL(request.url).searchParams.get("vacancy_id")?.trim() ?? "";
    if (!vacancyId || vacancyId.length > 80) return NextResponse.json({ error: "A valid vacancy_id is required." }, { status: 400 });

    const { data: vacancy, error: vacancyError } = await supabase
      .from("workforce_vacancies")
      .select("id,title,status,processing_authorized,authorization_reference,organization_id")
      .eq("id", vacancyId)
      .eq("organization_id", profile.organization_id)
      .maybeSingle();

    if (vacancyError) {
      console.error("workforce_candidate_vacancy_check_failed", vacancyError.code);
      return NextResponse.json({ error: "Workforce database is unavailable. Confirm the migration is applied." }, { status: 503 });
    }
    if (!vacancy) return NextResponse.json({ error: "Vacancy not found in your organization." }, { status: 404 });

    const { data, error } = await supabase
      .from("workforce_candidate_leads")
      .select("id,vacancy_id,source_id,source_candidate_id,display_name,profile_url,location_text,job_relevant_summary,job_relevant_skills,evidence_status,review_status,retrieved_at,retention_review_at,created_at,updated_at")
      .eq("organization_id", profile.organization_id)
      .eq("vacancy_id", vacancyId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("workforce_candidate_list_failed", error.code);
      return NextResponse.json({ error: "Unable to load candidate leads. Confirm the workforce migration has been applied." }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      vacancy: { id: vacancy.id, title: vacancy.title, status: vacancy.status, processing_authorized: vacancy.processing_authorized },
      candidates: data ?? [],
      sourcing: { configured: false, message: "No authorized live talent-source provider is connected. No candidates have been invented or searched." },
    });
  } catch {
    return NextResponse.json({ error: "Unable to load candidate leads." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { profile } = await getCurrentProfile(supabase);
    if (!profile?.organization_id || !profile.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await request.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return NextResponse.json({ error: "A candidate review update is required." }, { status: 400 });
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const candidateId = clean(body.candidate_id, 80);
    const nextStatus = clean(body.review_status, 40);
    const reason = clean(body.reason, 1000);
    if (!candidateId || !REVIEW_STATUSES.includes(nextStatus as ReviewStatus)) {
      return NextResponse.json({ error: "Provide a valid candidate_id and review_status." }, { status: 400 });
    }
    if (["not_progressing", "withdrawn"].includes(nextStatus) && reason.length < 3) {
      return NextResponse.json({ error: "Provide a short job-related reason for this review outcome." }, { status: 400 });
    }

    const { data: current, error: currentError } = await supabase
      .from("workforce_candidate_leads")
      .select("id,organization_id,vacancy_id,review_status")
      .eq("id", candidateId)
      .eq("organization_id", profile.organization_id)
      .maybeSingle();

    if (currentError) {
      console.error("workforce_candidate_review_lookup_failed", currentError.code);
      return NextResponse.json({ error: "Unable to verify candidate lead." }, { status: 503 });
    }
    if (!current) return NextResponse.json({ error: "Candidate lead not found in your organization." }, { status: 404 });

    const { data: vacancy, error: vacancyError } = await supabase
      .from("workforce_vacancies")
      .select("id")
      .eq("id", current.vacancy_id)
      .eq("organization_id", profile.organization_id)
      .maybeSingle();
    if (vacancyError || !vacancy) return NextResponse.json({ error: "Vacancy access could not be verified." }, { status: 403 });

    const { data: updated, error: updateError } = await supabase
      .from("workforce_candidate_leads")
      .update({ review_status: nextStatus })
      .eq("id", candidateId)
      .eq("organization_id", profile.organization_id)
      .select("id,review_status,updated_at")
      .single();

    if (updateError) {
      console.error("workforce_candidate_review_update_failed", updateError.code);
      return NextResponse.json({ error: "Unable to save review. Confirm the workforce migration has been applied." }, { status: 503 });
    }

    // Audit is best-effort if the server-only service key is configured; never expose it to the client.
    try {
      const admin = createAdminClient();
      const { error: auditError } = await admin.from("workforce_recruitment_events").insert({
        organization_id: profile.organization_id,
        vacancy_id: current.vacancy_id,
        candidate_lead_id: candidateId,
        actor_id: profile.id,
        event_type: "candidate_review_status_changed",
        from_status: current.review_status,
        to_status: nextStatus,
        reason: reason || null,
        metadata: { review_surface: "workforce_workspace" },
      });
      if (auditError) console.error("workforce_candidate_review_audit_failed", auditError.code);
    } catch {
      console.warn("workforce_candidate_review_audit_unavailable");
    }

    return NextResponse.json({ success: true, candidate: updated, audit: "best_effort" });
  } catch {
    return NextResponse.json({ error: "Unable to update candidate review." }, { status: 500 });
  }
}
