import { NextResponse } from "next/server"
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const AGREEMENT_VERSION = "1.0"

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    const profile = await getCurrentProfile()

    if (!user || !profile?.organization_id) {
      return NextResponse.json({ error: "You must be signed in with an organization." }, { status: 401 })
    }

    const body = await request.json()
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : ""

    if (!projectId) {
      return NextResponse.json({ error: "A Company Creation project is required." }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: project, error: projectError } = await supabase
      .from("company_creation_projects")
      .select("id,organization_id,company_name,business_idea,jurisdiction,stage,progress")
      .eq("id", projectId)
      .eq("organization_id", profile.organization_id)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: "The Company Creation project could not be found." }, { status: 404 })
    }

    const termsSnapshot = {
      agreement_type: "company_creation_proposed_framework",
      version: AGREEMENT_VERSION,
      proposed_equity_percent: 5,
      company_name: project.company_name,
      business_idea: project.business_idea,
      jurisdiction: project.jurisdiction,
      accepted_screen: true,
      legal_status: "proposed_framework_only",
      notes: [
        "This acceptance records the user's decision to continue with the proposed Company Creation framework.",
        "It does not by itself create or transfer equity.",
        "Any equity, service, IP, governance, vesting, dilution, termination, transfer, tax, dispute, or other legal rights must be established in a separate legally valid agreement applicable to the relevant jurisdiction.",
      ],
    }

    const { data: existing } = await supabase
      .from("company_creation_agreements")
      .select("id,version,status,accepted_at,accepted_by")
      .eq("project_id", projectId)
      .eq("version", AGREEMENT_VERSION)
      .eq("accepted_by", user.id)
      .maybeSingle()

    if (existing?.id) {
      await supabase
        .from("company_creation_projects")
        .update({ stage: "identity", progress: Math.max(project.progress, 35) })
        .eq("id", projectId)

      return NextResponse.json({ agreement: existing, alreadyAccepted: true })
    }

    const { data: agreement, error: agreementError } = await supabase
      .from("company_creation_agreements")
      .insert({
        project_id: projectId,
        version: AGREEMENT_VERSION,
        jurisdiction: project.jurisdiction,
        proposed_equity_percent: 5,
        terms_snapshot: termsSnapshot,
        accepted_at: new Date().toISOString(),
        accepted_by: user.id,
        status: "accepted",
      })
      .select("id,project_id,version,jurisdiction,proposed_equity_percent,terms_snapshot,accepted_at,accepted_by,status,created_at")
      .single()

    if (agreementError) {
      console.error("[company-creation] agreement insert failed:", agreementError.message)
      return NextResponse.json({ error: "Your acceptance could not be saved." }, { status: 500 })
    }

    const { error: projectUpdateError } = await supabase
      .from("company_creation_projects")
      .update({ stage: "identity", progress: Math.max(project.progress, 35) })
      .eq("id", projectId)
      .eq("organization_id", profile.organization_id)

    if (projectUpdateError) {
      console.error("[company-creation] project stage update failed:", projectUpdateError.message)
      return NextResponse.json({
        agreement,
        warning: "The agreement was saved, but the project stage could not be updated. You can continue safely.",
      })
    }

    return NextResponse.json({ agreement, alreadyAccepted: false })
  } catch (error) {
    console.error("[company-creation] agreement failed:", error)
    return NextResponse.json({ error: "The Company Creation Agreement could not be saved." }, { status: 500 })
  }
}
