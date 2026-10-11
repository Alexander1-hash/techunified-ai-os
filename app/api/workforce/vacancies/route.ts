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

    const { data, error } = await supabase
      .from("workforce_vacancies")
      .insert({
        organization_id: organizationId,
        created_by: userId,
        title,
        industry,
        jurisdiction,
        location_text: locationText,
        location_mode: locationMode,
        employment_type: employmentType,
        description,
        requirements,
        required_licences: requiredLicences,
        processing_authorized: processingAuthorized,
        authorization_reference: processingAuthorized ? authorizationReference : null,
        status,
      })
      .select("id,organization_id,created_by,title,industry,jurisdiction,location_text,location_mode,employment_type,description,requirements,required_licences,processing_authorized,status,created_at,updated_at")
      .single();

    if (error) {
      console.error("workforce_vacancy_create_failed", error.code);
      return NextResponse.json({ error: "Unable to save vacancy. Confirm the workforce database migration has been applied and your organization profile is configured." }, { status: 503 });
    }

    return NextResponse.json({ success: true, vacancy: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create vacancy." }, { status: 500 });
  }
}
