import { NextResponse } from "next/server"
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const catalog = [
  { key: "domain", category: "Infrastructure", title: "Domain registration", description: "Register and control the company's primary domain through an authorized registrar.", requiresProvider: true, inputs: ["selected domain", "registrant details", "payment method"] },
  { key: "business_email", category: "Infrastructure", title: "Business email", description: "Create professional mailboxes on the company's controlled domain.", requiresProvider: true, inputs: ["domain", "mailbox names", "recovery contact"] },
  { key: "website", category: "Build", title: "Company website", description: "Prepare and launch the company's public website from the approved company blueprint.", requiresProvider: true, inputs: ["brand assets", "pages", "contact details"] },
  { key: "brand", category: "Brand", title: "Brand identity system", description: "Create a consistent visual and messaging system for the company.", requiresProvider: false, inputs: ["approved name", "positioning", "visual direction"] },
  { key: "social", category: "Growth", title: "Social presence", description: "Prepare official profiles and launch assets for the company's selected platforms.", requiresProvider: true, inputs: ["handle choice", "profile copy", "brand assets"] },
  { key: "payments", category: "Finance", title: "Payment infrastructure", description: "Connect an authorized payment provider appropriate to the company's model and compliance requirements.", requiresProvider: true, inputs: ["business details", "owner details", "settlement account"] },
  { key: "accounting", category: "Finance", title: "Accounting setup", description: "Establish bookkeeping structure, chart of accounts, reporting cadence and provider requirements.", requiresProvider: true, inputs: ["business structure", "currency", "reporting needs"] },
]

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const profile = await getCurrentProfile()
  if (!profile?.organization_id) return NextResponse.json({ error: "Organization required" }, { status: 400 })
  const projectId = new URL(request.url).searchParams.get("projectId")
  if (!projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 })

  const supabase = await createClient()
  const { data: project, error } = await supabase.from("company_creation_projects").select("id, metadata").eq("id", projectId).eq("organization_id", profile.organization_id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

  const infrastructure = project.metadata?.infrastructure ?? {}
  const services = catalog.map((item) => ({
    ...item,
    blueprintStatus: infrastructure[item.key === "business_email" ? "email" : item.key]?.status ?? "not_planned",
    providerAction: item.requiresProvider ? "Provider action required" : "TechUnified preparation",
  }))
  return NextResponse.json({ services })
}
