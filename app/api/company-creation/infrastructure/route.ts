import { NextResponse } from "next/server"
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const buildPlan = (project: any) => ({
  projectId: project.id,
  status: "planning",
  note: "TechUnified prepares the action plan. Actual accounts, purchases, registrations, and provider connections remain controlled by the relevant provider.",
  domain: { status: "provider_required", detail: "Choose a domain registrar, check the final name, and register the selected domain.", requiredInputs: ["selected domain", "registrant details", "payment method"] },
  email: { status: "provider_required", detail: "Create business mailboxes using the chosen domain and email provider.", requiredInputs: ["domain", "mailbox names", "recovery contact"] },
  website: { status: "ready_to_build", detail: "Prepare the website structure, copy, assets, and deployment plan before connecting hosting.", requiredInputs: ["brand assets", "pages", "contact details"] },
  brand: { status: "ready_to_define", detail: "Define the visual identity, messaging, and reusable brand assets.", requiredInputs: ["name", "positioning", "visual direction"] },
  social: { status: "provider_required", detail: "Create and control official social profiles through each social platform.", requiredInputs: ["handle choice", "profile copy", "brand assets"] },
  payments: { status: "provider_required", detail: "Select an appropriate payment provider and complete its business verification.", requiredInputs: ["legal/business details", "owner details", "settlement account"] },
})

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const profile = await getCurrentProfile()
  if (!profile?.organization_id) return NextResponse.json({ error: "Organization required" }, { status: 400 })
  const projectId = new URL(request.url).searchParams.get("projectId")
  if (!projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 })

  const supabase = await createClient()
  const { data: project, error } = await supabase.from("company_creation_projects").select("*").eq("id", projectId).eq("organization_id", profile.organization_id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

  return NextResponse.json({ plan: project.metadata?.infrastructure ?? buildPlan(project) })
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const profile = await getCurrentProfile()
  if (!profile?.organization_id) return NextResponse.json({ error: "Organization required" }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const projectId = body.projectId
  if (!projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 })

  const supabase = await createClient()
  const { data: project, error: projectError } = await supabase.from("company_creation_projects").select("*").eq("id", projectId).eq("organization_id", profile.organization_id).maybeSingle()
  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 })
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

  const plan = buildPlan(project)
  const metadata = { ...(project.metadata ?? {}), infrastructure: plan }
  const { error: updateError } = await supabase.from("company_creation_projects").update({
    metadata,
    stage: "infrastructure",
    progress: Math.max(project.progress ?? 0, 75),
    updated_at: new Date().toISOString(),
  }).eq("id", project.id).eq("organization_id", profile.organization_id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json({ plan })
}
