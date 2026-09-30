import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/server"

export const dynamic = "force-dynamic"

function nigeriaAssessment() {
  return {
    entity_path: "Needs user choice",
    recommendation_status: "needs_user_choice",
    checklist: [
      { title: "Choose formation path", status: "needs_input", detail: "Choose the applicable CAC route, such as a Business Name or company, based on the venture and its ownership structure." },
      { title: "Confirm proposed name", status: "official_check", detail: "CAC requires a preliminary name-availability search before formal reservation and registration." },
      { title: "Define principal activity", status: "needs_input", detail: "Record the main business activity and identify any regulated activity that may need sector approval." },
      { title: "Prepare registered office details", status: "needs_input", detail: "Prepare a traceable registered-office address and required contact information." },
      { title: "Prepare ownership and officer information", status: "needs_input", detail: "Collect the information and identification required for the selected formation route." },
      { title: "Check sector approvals", status: "professional_review", detail: "Some regulated or designated activities can require additional approvals before or alongside registration." },
      { title: "Submit through the official channel", status: "official_check", detail: "Final filing, payment and registration should be completed through CAC's official portal or an authorized agent." }
    ],
    regulatory_flags: [
      "Planning intelligence only; not legal or tax advice.",
      "Regulated industries may have additional requirements.",
      "Official fees and requirements can change; verify them before payment or submission."
    ],
    official_links: [
      { label: "CAC Company Registration", url: "https://www.cac.gov.ng/services/company-registration" },
      { label: "CAC Business Name Registration", url: "https://www.cac.gov.ng/services/business-name" },
      { label: "CAC Registration Portal", url: "https://icrp.cac.gov.ng/" },
      { label: "CAC Company Search", url: "https://www.cac.gov.ng/services/company-search" }
    ]
  }
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  const profile = user ? await getCurrentProfile(user.id) : null
  if (!user || !profile?.organization_id) return NextResponse.json({ error: "You must be signed in." }, { status: 401 })
  const projectId = new URL(request.url).searchParams.get("projectId")
  if (!projectId) return NextResponse.json({ error: "projectId is required." }, { status: 400 })
  const supabase = await createClient()
  const { data: project } = await supabase.from("company_creation_projects").select("id").eq("id", projectId).eq("organization_id", profile.organization_id).maybeSingle()
  if (!project) return NextResponse.json({ error: "Company Creation project not found." }, { status: 404 })
  const { data, error } = await supabase.from("company_creation_formation_assessments").select("*").eq("project_id", project.id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ assessment: data })
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  const profile = user ? await getCurrentProfile(user.id) : null
  if (!user || !profile?.organization_id) return NextResponse.json({ error: "You must be signed in." }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const projectId = typeof body.projectId === "string" ? body.projectId : ""
  if (!projectId) return NextResponse.json({ error: "projectId is required." }, { status: 400 })
  const supabase = await createClient()
  const { data: project, error: projectError } = await supabase.from("company_creation_projects").select("id, jurisdiction").eq("id", projectId).eq("organization_id", profile.organization_id).maybeSingle()
  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 })
  if (!project) return NextResponse.json({ error: "Company Creation project not found." }, { status: 404 })

  if ((project.jurisdiction || "Nigeria") !== "Nigeria") {
    return NextResponse.json({ assessment: null, message: "Formation intelligence for this jurisdiction is not verified yet." })
  }

  const assessment = nigeriaAssessment()
  const { data, error } = await supabase.from("company_creation_formation_assessments").upsert({
    project_id: project.id,
    jurisdiction: "Nigeria",
    entity_path: assessment.entity_path,
    recommendation_status: assessment.recommendation_status,
    checklist: assessment.checklist,
    regulatory_flags: assessment.regulatory_flags,
    official_links: assessment.official_links,
    metadata: { generated_by: "formation_intelligence", generated_at: new Date().toISOString() },
    updated_at: new Date().toISOString()
  }, { onConflict: "project_id" }).select("*").single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await supabase.from("company_creation_projects").update({ stage: "formation", progress: 60, updated_at: new Date().toISOString() }).eq("id", project.id)
  return NextResponse.json({ assessment: data })
}
