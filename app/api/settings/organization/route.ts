import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canManageOrganization, type Role } from '@/lib/auth/permissions'

const urlPattern = /^https?:\/\/[^\s]+$/i

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in to continue.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.organization_id) return NextResponse.json({ error: 'You do not belong to an organization yet.' }, { status: 403 })
  if (!canManageOrganization(profile.role as Role)) {
    return NextResponse.json({ error: 'You need an Admin or Owner role to edit organization settings.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const description = typeof body?.description === 'string' ? body.description.trim() : ''
  const industry = typeof body?.industry === 'string' ? body.industry.trim() : ''
  const website = typeof body?.website === 'string' ? body.website.trim() : ''
  const timezone = typeof body?.timezone === 'string' ? body.timezone.trim() : ''

  if (!name || name.length > 120) return NextResponse.json({ error: 'Enter a company name up to 120 characters.' }, { status: 400 })
  if (description.length > 500) return NextResponse.json({ error: 'Keep the description under 500 characters.' }, { status: 400 })
  if (industry && industry.length > 120) return NextResponse.json({ error: 'Enter an industry up to 120 characters.' }, { status: 400 })
  if (website && (!urlPattern.test(website) || website.length > 300)) return NextResponse.json({ error: 'Enter a valid website URL beginning with http:// or https://.' }, { status: 400 })
  if (timezone && timezone.length > 100) return NextResponse.json({ error: 'Choose a valid timezone.' }, { status: 400 })

  // RLS (organizations_update_own) restricts updates to the caller's organization.
  const { data, error } = await supabase
    .from('organizations')
    .update({
      name,
      description: description || null,
      industry: industry || null,
      website: website || null,
      timezone: timezone || 'Africa/Lagos',
    })
    .eq('id', profile.organization_id)
    .select('id, name, description, industry, website, timezone')
    .single()

  if (error) {
    console.error('[settings/organization] update failed:', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'We could not save organization settings. Please try again.' }, { status: 400 })
  }
  return NextResponse.json({ organization: data })
}
