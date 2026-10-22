import { NextResponse } from "next/server"
import OpenAI from "openai"
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"



type ArchitectResult = {
  company_summary: string
  industry: string
  business_model: string
  target_customer: string
  key_assumptions: string[]
  missing_information: Array<{ question: string; why_it_matters: string }>
  roadmap: Array<{ category: string; title: string; description: string; priority: "high" | "medium" | "low" }>
  next_action: string
}

const fallback = (idea: string): ArchitectResult => ({
  company_summary: idea,
  industry: "To be determined",
  business_model: "To be determined",
  target_customer: "To be determined",
  key_assumptions: [],
  missing_information: [
    { question: "Who is the primary customer?", why_it_matters: "This affects the offer, pricing, and marketing." },
    { question: "Where will the company operate?", why_it_matters: "Jurisdiction affects formation and compliance." },
    { question: "How will the company make money?", why_it_matters: "Revenue model affects pricing, payments, and accounting." },
  ],
  roadmap: [
    { category: "identity", title: "Define company identity", description: "Confirm the name, offer, customer, and jurisdiction.", priority: "high" },
    { category: "formation", title: "Plan formation and compliance", description: "Identify official registration, tax, and regulatory steps to verify.", priority: "high" },
    { category: "infrastructure", title: "Build digital infrastructure", description: "Plan domain, email, brand, website, and operating tools.", priority: "medium" },
  ],
  next_action: "Answer the missing questions so the Company Architect can refine the roadmap.",
})

export async function GET() {
  try {
    const user = await getCurrentUser()
    const profile = await getCurrentProfile()
    if (!user || !profile?.organization_id) return NextResponse.json({ error: "You must be signed in with an organization." }, { status: 401 })

    const supabase = await createClient()
    const { data: project, error: projectError } = await supabase
      .from("company_creation_projects")
      .select("id,company_name,business_idea,jurisdiction,stage,progress,metadata,created_at,updated_at")
      .eq("organization_id", profile.organization_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (projectError) return NextResponse.json({ error: "Your Company Creation workspace could not be loaded." }, { status: 500 })
    if (!project) return NextResponse.json({ project: null, agreement: null, tasks: [] })

    const [{ data: agreement }, { data: tasks }] = await Promise.all([
      supabase.from("company_creation_agreements").select("id,version,status,accepted_at,accepted_by").eq("project_id", project.id).eq("accepted_by", user.id).eq("status", "accepted").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("company_creation_tasks").select("id,category,title,description,status,provider_key,external_reference,metadata").eq("project_id", project.id).order("created_at", { ascending: true }),
    ])
    return NextResponse.json({ project, agreement: agreement || null, tasks: tasks || [] })
  } catch (error) {
    console.error("[company-creation] resume lookup failed:", error)
    return NextResponse.json({ error: "Your Company Creation workspace could not be loaded." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    const profile = await getCurrentProfile()

    if (!user || !profile?.organization_id) {
      return NextResponse.json({ error: "You must be signed in with an organization." }, { status: 401 })
    }

    const body = await request.json()
    const idea = typeof body.idea === "string" ? body.idea.trim() : ""
    const companyName = typeof body.companyName === "string" ? body.companyName.trim() : null
    const jurisdiction = typeof body.jurisdiction === "string" ? body.jurisdiction.trim() : "Nigeria"\n    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : ""

    if (idea.length < 20) {
      return NextResponse.json({ error: "Describe the company idea in at least 20 characters." }, { status: 400 })
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "AI configuration is missing on the server." }, { status: 503 })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
      input: `You are TechUnified AI OS Company Architect. Convert the founder's idea into a practical company-building blueprint. Do not claim TechUnified is a government registrar, bank, law firm, tax authority, trademark office, or regulated provider. Do not invent provider availability, prices, legal requirements, or guaranteed outcomes. Return ONLY valid JSON with keys: company_summary, industry, business_model, target_customer, key_assumptions (array), missing_information (array of {question,why_it_matters}), roadmap (array of {category,title,description,priority}), next_action. Roadmap priority must be high, medium, or low. Business idea: ${idea}. Company name: ${companyName || "Not decided"}. Jurisdiction: ${jurisdiction}.`,
    })

    let architect: ArchitectResult
    try {
      architect = JSON.parse(response.output_text) as ArchitectResult
    } catch {
      architect = fallback(idea)
    }

    const supabase = await createClient()
    let project: any
    let error: any = null

    if (projectId) {
      const { data: existingProject, error: lookupError } = await supabase
        .from("company_creation_projects")
        .select("id,company_name,business_idea,jurisdiction,stage,progress,metadata")
        .eq("id", projectId)
        .eq("organization_id", profile.organization_id)
        .single()
      if (lookupError || !existingProject) return NextResponse.json({ error: "The Company Creation project could not be found." }, { status: 404 })

      const { data: updatedProject, error: updateError } = await supabase
        .from("company_creation_projects")
        .update({ company_name: companyName || existingProject.company_name, business_idea: idea, jurisdiction, metadata: { ...(existingProject.metadata || {}), architect, source: "company_creation_architect" }, updated_at: new Date().toISOString() })
        .eq("id", projectId)
        .eq("organization_id", profile.organization_id)
        .select("id,company_name,business_idea,jurisdiction,stage,progress,metadata")
        .single()
      project = updatedProject
      error = updateError
    } else {
      const { data: insertedProject, error: insertError } = await supabase.from("company_creation_projects").insert({
        organization_id: profile.organization_id, created_by: user.id, company_name: companyName, business_idea: idea, jurisdiction,
        stage: "idea", progress: 10, metadata: { architect, source: "company_creation_architect" },
      }).select("id,company_name,business_idea,jurisdiction,stage,progress,metadata").single()
      project = insertedProject
      error = insertError
    }

    if (error || !project) {
      console.error("[company-creation] project save failed:", error?.message)
      return NextResponse.json({ error: "The plan was generated but could not be saved." }, { status: 500 })
    }

    const { data: existingTasks } = await supabase.from("company_creation_tasks").select("title").eq("project_id", project.id)
    const existingTitles = new Set((existingTasks || []).map((task) => task.title))
    const tasks = architect.roadmap.filter((item) => !existingTitles.has(item.title)).map((item) => ({
      project_id: project.id, category: item.category, title: item.title, description: item.description, status: "planned",
      metadata: { priority: item.priority, source: "company_architect" },
    }))
    if (tasks.length) {
      const { error: taskError } = await supabase.from("company_creation_tasks").insert(tasks)
      if (taskError) console.error("[company-creation] task save failed:", taskError.message)
    }

    return NextResponse.json({ project, architect })
  } catch (error) {
    console.error("[company-creation] architect failed:", error)
    return NextResponse.json({ error: "The Company Architect could not complete this step." }, { status: 500 })
  }
}
