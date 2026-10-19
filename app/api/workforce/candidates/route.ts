import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/repositories/profile";

export const dynamic = "force-dynamic";

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
    if (!["owner", "admin", "organization_admin", "recruiter", "hiring_manager"].includes(profile.role)) {
      return NextResponse.json({ error: "Your account role does not have permission to view candidate information." }, { status: 403 });
    }

    const vacancyId = new URL(request.url).searchParams.get("vacancy_id")?.trim() ?? "";
    if (!vacancyId || vacancyId.length > 80) return NextResponse.json({ error: "A valid vacancy_id is required." }, { status: 400 });

    const { data: vacancy, error: vacancyError } = await supabase
      .from("workforce_vacancies")
      .select("id,title,status,processing_authorized,authorization_reference,organization_id,requirements,required_licences")
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

    const { data: auditEvents, error: auditError } = await supabase
      .from("workforce_recruitment_events")
      .select("id,event_type,from_status,to_status,reason,metadata,occurred_at,actor_id,candidate_lead_id")
      .eq("organization_id", profile.organization_id)
      .eq("vacancy_id", vacancyId)
      .order("occurred_at", { ascending: false })
      .limit(100);

    if (auditError) {
      console.error("workforce_recruitment_audit_read_failed", auditError.code);
    }

    const approvedSourceIds = [...new Set((process.env.WORKFORCE_APPROVED_SOURCE_IDS ?? "")
      .split(",")
      .map((source) => source.trim())
      .filter(Boolean))];
    const ingestionSecretConfigured = (process.env.WORKFORCE_INGESTION_SECRET ?? "").length >= 32;
    const ingestionConfigured = ingestionSecretConfigured && approvedSourceIds.length > 0;

    const requirements = Array.isArray(vacancy.requirements)
      ? vacancy.requirements.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 80)
      : [];
    const requiredLicences = Array.isArray(vacancy.required_licences)
      ? vacancy.required_licences.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 30)
      : [];
    const assessedCandidates = (data ?? []).map((candidate) => {
      const retentionReviewAt = new Date(candidate.retention_review_at).getTime();
      const daysUntilRetentionReview = Number.isFinite(retentionReviewAt)
        ? Math.ceil((retentionReviewAt - Date.now()) / (24 * 60 * 60 * 1000))
        : null;
      const retentionStatus = daysUntilRetentionReview === null
        ? "unknown"
        : daysUntilRetentionReview < 0
          ? "overdue"
          : daysUntilRetentionReview <= 14
            ? "due_soon"
            : "scheduled";
      const evidenceText = [candidate.job_relevant_summary ?? "", ...(Array.isArray(candidate.job_relevant_skills) ? candidate.job_relevant_skills : [])].join(" ").toLocaleLowerCase();
      const matchedRequirements = requirements.filter((requirement) => evidenceText.includes(requirement.toLocaleLowerCase()));
      return {
        ...candidate,
        retentionStatus,
        daysUntilRetentionReview,
        requirementCoverage: {
          matchedCount: matchedRequirements.length,
          totalCount: requirements.length,
          matchedRequirements,
          missingRequirements: requirements.filter((requirement) => !matchedRequirements.includes(requirement)),
          method: "literal_keyword_overlap",
        },
        requiredLicences,
        licencesRequireIndependentVerification: requiredLicences.length > 0,
      };
    });

    return NextResponse.json({
      success: true,
      vacancy: { id: vacancy.id, title: vacancy.title, status: vacancy.status, processing_authorized: vacancy.processing_authorized },
      candidates: assessedCandidates,
      auditEvents: auditEvents ?? [],
      auditAvailable: !auditError,
      sourcing: {
        ingestionConfigured,
        ingestionEndpoint: "/api/workforce/providers/ingest",
        liveSearchConnected: false,
        approvedSourceCount: approvedSourceIds.length,
        message: ingestionConfigured
          ? "Trusted ingestion is configured for approved source IDs, but live search is not connected until a real authorized provider adapter is implemented and tested."
          : "Trusted ingestion is not fully configured. Set a server-only WORKFORCE_INGESTION_SECRET of at least 32 characters and WORKFORCE_APPROVED_SOURCE_IDS. Live search still requires a real authorized provider adapter.",
      },
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
    if (!["owner", "admin", "organization_admin", "recruiter", "hiring_manager"].includes(profile.role)) {
      return NextResponse.json({ error: "Your account role does not have permission to review candidates." }, { status: 403 });
    }

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

    const { data, error: reviewError } = await supabase.rpc("review_workforce_candidate_lead", {
      p_candidate_id: candidateId,
      p_review_status: nextStatus,
      p_reason: reason || null,
    });

    if (reviewError) {
      console.error("workforce_candidate_review_rpc_failed", reviewError.code);
      if (reviewError.code === "P0002") return NextResponse.json({ error: "Candidate lead not found in your organization." }, { status: 404 });
      if (reviewError.code === "42501") return NextResponse.json({ error: "Your organization access could not be verified." }, { status: 403 });
      if (reviewError.code === "22023") return NextResponse.json({ error: "A valid review status and job-related reason are required." }, { status: 400 });
      return NextResponse.json({ error: "Unable to save review. Confirm the workforce security migration has been applied." }, { status: 503 });
    }

    const updated = Array.isArray(data) ? data[0] : data;
    if (!updated) return NextResponse.json({ error: "Candidate review was not updated." }, { status: 503 });
    return NextResponse.json({ success: true, candidate: updated, audit: "recorded_atomically" });
  } catch {
    return NextResponse.json({ error: "Unable to update candidate review." }, { status: 500 });
  }
}
