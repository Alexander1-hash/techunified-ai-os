import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/server"

export const dynamic = "force-dynamic"

type DomainCheck = {
  domain: string
  status: "registered" | "not_found" | "unknown"
  source: "RDAP" | "provider"
  checked_at: string
}

function cleanDomain(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]
}

async function checkDomain(domain: string): Promise<DomainCheck> {
  const checkedAt = new Date().toISOString()
  if (!domain || !domain.includes(".")) {
    return { domain, status: "unknown", source: "provider", checked_at: checkedAt }
  }

  try {
    const response = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      headers: { Accept: "application/rdap+json, application/json" },
      cache: "no-store",
    })

    if (response.status === 404) {
      return { domain, status: "not_found", source: "RDAP", checked_at: checkedAt }
    }

    if (response.ok) {
      return { domain, status: "registered", source: "RDAP", checked_at: checkedAt }
    }

    return { domain, status: "unknown", source: "RDAP", checked_at: checkedAt }
  } catch {
    return { domain, status: "unknown", source: "RDAP", checked_at: checkedAt }
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  const profile = user ? await getCurrentProfile(user.id) : null

  if (!user || !profile?.organization_id) {
    return NextResponse.json({ error: "You must be signed in to verify identity candidates." }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const projectId = typeof body.projectId === "string" ? body.projectId : ""
  if (!projectId) return NextResponse.json({ error: "projectId is required." }, { status: 400 })

  const supabase = await createClient()

  const { data: project, error: projectError } = await supabase
    .from("company_creation_projects")
    .select("id, organization_id, jurisdiction")
    .eq("id", projectId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle()

  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 })
  if (!project) return NextResponse.json({ error: "Company Creation project not found." }, { status: 404 })

  const { data: identity, error: identityError } = await supabase
    .from("company_creation_identity_checks")
    .select("*")
    .eq("project_id", project.id)
    .maybeSingle()

  if (identityError) return NextResponse.json({ error: identityError.message }, { status: 500 })
  if (!identity) return NextResponse.json({ error: "Generate identity candidates before verifying them." }, { status: 400 })

  const domains = Array.isArray(identity.domain_candidates)
    ? identity.domain_candidates.map((item: unknown) => typeof item === "string" ? cleanDomain(item) : "").filter(Boolean).slice(0, 10)
    : []

  const domainChecks = await Promise.all(domains.map(checkDomain))
  const hasUnknown = domainChecks.some((check) => check.status === "unknown")
  const hasNotFound = domainChecks.some((check) => check.status === "not_found")
  const hasRegistered = domainChecks.some((check) => check.status === "registered")

  const verificationStatus =
    domainChecks.length === 0 || hasUnknown
      ? "needs_provider_check"
      : hasNotFound && !hasRegistered
        ? "verified_available"
        : hasRegistered && !hasNotFound
          ? "verified_unavailable"
          : "needs_provider_check"

  const metadata = {
    ...(identity.metadata || {}),
    verification: {
      checked_at: new Date().toISOString(),
      domain_checks: domainChecks,
      company_name_check: {
        status: project.jurisdiction === "Nigeria" ? "official_registry_required" : "provider_check_required",
        note: project.jurisdiction === "Nigeria"
          ? "CAC name availability must be checked/reserved through the official CAC/iCRP process."
          : "Company-name availability requires the applicable official registry or authorized provider.",
      },
      social_handle_check: {
        status: "provider_check_required",
        note: "Social platform availability is not verified by this check.",
      },
    },
  }

  const { data: updatedIdentity, error: updateError } = await supabase
    .from("company_creation_identity_checks")
    .update({
      verification_status: verificationStatus,
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq("project_id", project.id)
    .select("*")
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({
    identity: updatedIdentity,
    verification: {
      domain_checks: domainChecks,
      company_name: metadata.company_name_check,
      social_handles: metadata.social_handle_check,
      official_cac_url: project.jurisdiction === "Nigeria" ? "https://icrp.cac.gov.ng/" : null,
    },
  })
}
