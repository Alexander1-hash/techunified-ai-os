import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/repositories/profile";

const LOCATION_MODES = ["local", "region", "country", "worldwide", "remote"] as const;
const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "temporary", "internship", "unspecified"] as const;
const VACANCY_STATUSES = ["draft", "open", "paused", "filled", "cancelled"] as const;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function stringArray(value: unknown, maxItems: number, maxLength: number): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const result = value.map((item) => text(item, maxLength));
  if (result.some((item) => !item)) return null;
  return [...new Set(result)];
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { profile } = await getCurrentProfile(supabase);
    const organizationId = profile?.organization_id;

    if (!organizationId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const params = new URL(request.url).searchParams;
    const status = params.get("status")?.trim() ?? "";
    if (status && !VACANCY_STATUSES.includes(status as (typeof VACANCY_STATUSES)[number])) {
      return NextResponse.json({ error: "Invalid vacancy status." }, { status: 400 });
    }

    let query = supabase
      .from("workforce_vacancies")
      .select("id,organization_id,created_by,title,industry,jurisdiction,location_text,location_mode,employment_type,description,requirements,required_licences,processing_authorized,status,created_at,updated_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) {
      console.error("workforce_vacancies_list_failed", error.code);
      return NextResponse.json({ error: "Unable to load vacancies. Confirm the workforce database migration has been applied." }, { status: 503 });
    }

    return NextResponse.json({ success: true, vacancies: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Unable to load vacancies." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { profile } = await getCurrentProfile(supabase);
    const organizationId = profile?.organization_id;
    const userId = profile?.id;

    if (!organizationId || !userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (!["owner", "admin", "organization_admin", "recruiter", "hiring_manager"].includes(profile.role)) {
      return NextResponse.json({ error: "Your account role does not have permission to create vacancies." }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await request.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return NextResponse.json({ error: "A vacancy object is required." }, { status: 400 });
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const title = text(body.title, 160);
    const industry = text(body.industry, 120);
    const jurisdiction = text(body.jurisdiction, 160);
    const locationText = text(body.location_text, 240);
    const description = text(body.description, 12000);
    const locationMode = text(body.location_mode || "local", 30);
    const employmentType = text(body.employment_type || "unspecified", 30);
    const requirements = stringArray(body.requirements, 80, 240);
    const requiredLicences = stringArray(body.required_licences, 30, 240);
    const processingAuthorized = body.processing_authorized === true;
    const authorizationReference = text(body.authorization_reference, 500);
    const status = text(body.status || "draft", 20);

    if (title.length < 2 || industry.length < 2 || jurisdiction.length < 2 || locationText.length < 2 || description.length < 10) {
      return NextResponse.json({ error: "Provide a job title, industry, jurisdiction, location and description." }, { status: 400 });
    }
    if (!LOCATION_MODES.includes(locationMode as (typeof LOCATION_MODES)[number])) {
      return NextResponse.json({ error: "Invalid location mode." }, { status: 400 });
    }
    if (!EMPLOYMENT_TYPES.includes(employmentType as (typeof EMPLOYMENT_TYPES)[number])) {
      return NextResponse.json({ error: "Invalid employment type." }, { status: 400 });
    }
    if (!VACANCY_STATUSES.includes(status as (typeof VACANCY_STATUSES)[number]) || !["draft", "open"].includes(status)) {
      return NextResponse.json({ error: "New vacancies can only be saved as draft or opened." }, { status: 400 });
    }
    if (!requirements || !requiredLicences) {
      return NextResponse.json({ error: "Requirements and licence lists must be valid arrays within the supported limits." }, { status: 400 });
    }
    if (status === "open" && (!processingAuthorized || !authorizationReference)) {
      return NextResponse.json({ error: "Documented candidate-processing authorization is required before opening a vacancy for sourcing." }, { status: 400 });
    }
    if (processingAuthorized && !authorizationReference) {
      return NextResponse.json({ error: "Provide the authorization reference or leave processing authorization disabled." }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("create_workforce_vacancy", {
      p_title: title,
      p_industry: industry,
      p_jurisdiction: jurisdiction,
      p_location_text: locationText,
      p_location_mode: locationMode,
      p_employment_type: employmentType,
      p_description: description,
      p_requirements: requirements,
      p_required_licences: requiredLicences,
      p_processing_authorized: processingAuthorized,
      p_authorization_reference: processingAuthorized ? authorizationReference : null,
      p_status: status,
    });

    if (error) {
      console.error("workforce_vacancy_create_rpc_failed", error.code);
      if (error.code === "42501") {
        return NextResponse.json({ error: "Your role or documented processing authorization does not permit this vacancy creation." }, { status: 403 });
      }
      if (error.code === "22023") {
        return NextResponse.json({ error: "Vacancy fields or authorization details are invalid." }, { status: 400 });
      }
      return NextResponse.json({ error: "Unable to save vacancy. Confirm the atomic vacancy creation migration has been applied." }, { status: 503 });
    }

    const vacancy = Array.isArray(data) ? data[0] : data;
    if (!vacancy) return NextResponse.json({ error: "Vacancy creation returned no record." }, { status: 503 });
    return NextResponse.json({ success: true, vacancy, audit: "recorded_atomically" }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create vacancy." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { profile } = await getCurrentProfile(supabase);
    if (!profile?.organization_id || !profile.id) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (!["owner", "admin", "organization_admin", "recruiter", "hiring_manager"].includes(profile.role)) {
      return NextResponse.json({ error: "Your account role does not have permission to manage vacancies." }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await request.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return NextResponse.json({ error: "A vacancy status transition is required." }, { status: 400 });
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const vacancyId = text(body.vacancy_id, 80);
    const nextStatus = text(body.status, 20);
    const reason = text(body.reason, 1000);
    if (!vacancyId || !VACANCY_STATUSES.includes(nextStatus as (typeof VACANCY_STATUSES)[number])) {
      return NextResponse.json({ error: "Provide a vacancy ID and valid target status." }, { status: 400 });
    }
    if (["draft", "paused", "filled", "cancelled"].includes(nextStatus) && reason.length < 3) {
      return NextResponse.json({ error: "A short operational reason is required for this status change." }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("transition_workforce_vacancy_status", {
      p_vacancy_id: vacancyId,
      p_next_status: nextStatus,
      p_reason: reason || null,
    });
    if (error) {
      console.error("workforce_vacancy_transition_failed", error.code);
      if (error.code === "P0002") return NextResponse.json({ error: "Vacancy not found in your organization." }, { status: 404 });
      if (error.code === "42501") return NextResponse.json({ error: "Your role or documented sourcing authorization does not permit this transition." }, { status: 403 });
      if (error.code === "22023") return NextResponse.json({ error: "The requested status transition is invalid or requires a reason." }, { status: 400 });
      return NextResponse.json({ error: "Unable to update vacancy. Confirm the vacancy lifecycle migration has been applied." }, { status: 503 });
    }

    const updated = Array.isArray(data) ? data[0] : data;
    if (!updated) return NextResponse.json({ error: "Vacancy status was not updated." }, { status: 503 });
    return NextResponse.json({ success: true, vacancy: updated, audit: "recorded_atomically" });
  } catch {
    return NextResponse.json({ error: "Unable to update vacancy status." }, { status: 500 });
  }
}
