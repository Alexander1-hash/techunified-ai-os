import { NextResponse } from "next/server"
import OpenAI from "openai"
import { createClient } from "@/lib/supabase/server"
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/server"

export const dynamic = "force-dynamic"

type IdentityResult = {
  suggested_names: string[]
  domain_candidates: string[]
  social_handles: string[]
  rationale: string
}

function fallbackIdentity(companyName: string, idea: string): IdentityResult {
  const base = companyName.trim() || idea.trim().split(/\s+/).slice(0, 3).join(" ")
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "newcompany"
  const names = [base, `${base} Labs`, `${base} Technologies`].filter(Boolean)
  return {
    suggested_names: Array.from(new Set(names)).slice(0, 5),
    domain_candidates: [`${slug}.com`, `${slug}.africa`, `${slug}.ng`],
    social_handles: [slug, `${slug}hq`, `get${slug}`],
    rationale: "These are naming and identity suggestions only. Availability has not been verified with a registrar, registry, or social platform.",
  }
}

async function getProject(supabase: Awaited<ReturnType<typeof createClient>>, projectId: string, organizationId: string) {
  const { data, error } = await supabase
    .from("company_creation_projects")
    .select("id, company_name, business_idea, jurisdiction, stage, progress, metadata")
    .eq("id", projectId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  const profile = user ? await getCurrentProfile(user.id) : null
  if (!user || !profile?.organization_id) {
    return NextResponse.json({ error: "You must be signed in to view identity intelligence." }, { status: 401 })
  }

  const supabase = await createClient()
  const url = new URL(request.url)
  const projectId = url.searchParams.get("projectId")

  let projectQuery = supabase
    .from("company_creation_projects")
    .select("id, company_name, business_idea, jurisdiction, stage, progress, metadata")
    .eq("organization_id", profile.organization_id)
    .order("updated_at", { ascending: false })
    .limit(1)

  if (projectId) projectQuery = projectQuery.eq("id", projectId)

  const { data: project, error: projectError } = await projectQuery.maybeSingle()
  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 })
  if (!project) return NextResponse.json({ project: null, identity: null })

  const { data: identity, error: identityError } = await supabase
    .from("company_creation_identity_checks")
    .select("*")
    .eq("project_id", project.id)
    .maybeSingle()

  if (identityError) return NextResponse.json({ error: identityError.message }, { status: 500 })
  return NextResponse.json({ project, identity })
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  const profile = user ? await getCurrentProfile(user.id) : null
  if (!user || !profile?.organization_id) {
    return NextResponse.json({ error: "You must be signed in to generate identity intelligence." }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const projectId = typeof body.projectId === "string" ? body.projectId : ""
  if (!projectId) return NextResponse.json({ error: "projectId is required." }, { status: 400 })

  const supabase = await createClient()
  const project = await getProject(supabase, projectId, profile.organization_id)
  if (!project) return NextResponse.json({ error: "Company Creation project not found." }, { status: 404 })

  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : project.company_name?.trim() || ""
  const idea = project.business_idea

  let result: IdentityResult | null = null
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const response = await openai.responses.create({
        model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: "You are TechUnified's Company Identity Architect. Generate practical company naming and digital identity candidates. Never claim a name, domain, social handle, trademark, or registration is available. Return only valid JSON with suggested_names (5 strings), domain_candidates (5 strings), social_handles (5 strings), rationale (string).",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify({ company_name: companyName, business_idea: idea, jurisdiction: project.jurisdiction }),
              },
            ],
          },
        ],
      })
      const text = response.output_text?.trim()
      if (text) result = JSON.parse(text) as IdentityResult
    } catch {
      result = null
    }
  }

  result = result || fallbackIdentity(companyName, idea)

  const proposedName = result.suggested_names[0] || companyName || null
  const slug = proposedName?.toLowerCase().replace(/[^a-z0-9]+/g, "") || ""
  const normalized = slug || null

  const { data: identity, error } = await supabase
    .from("company_creation_identity_checks")
    .upsert({
      project_id: project.id,
      proposed_name: proposedName,
      normalized_name: normalized,
      domain_candidates: result.domain_candidates,
      social_handles: result.social_handles,
      verification_status: "needs_provider_check",
      metadata: {
        generated_by: "company_identity_architect",
        rationale: result.rationale,
        generated_at: new Date().toISOString(),
        verification_note: "Not verified. Provider or official registry checks are required.",
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: "project_id" })
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase
    .from("company_creation_projects")
    .update({
      stage: "identity",
      progress: Math.max(project.progress || 0, 45),
      updated_at: new Date().toISOString(),
    })
    .eq("id", project.id)

  return NextResponse.json({ identity, result })
}
