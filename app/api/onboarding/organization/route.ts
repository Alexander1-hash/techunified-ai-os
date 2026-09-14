import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const websitePattern = /^https?:\/\/[^\s]+$/i

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in to continue.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const industry = typeof body?.industry === 'string' ? body.industry.trim() : ''
  const website = typeof body?.website === 'string' ? body.website.trim() : ''
  const timezone = typeof body?.timezone === 'string' ? body.timezone.trim() : 'Africa/Lagos'

  if (!name || name.length > 120) return NextResponse.json({ error: 'Enter a company name up to 120 characters.' }, { status: 400 })
  if (!industry || industry.length > 120) return NextResponse.json({ error: 'Enter your company industry.' }, { status: 400 })
  if (website && (!websitePattern.test(website) || website.length > 300)) return NextResponse.json({ error: 'Enter a valid website URL beginning with http:// or https://.' }, { status: 400 })
  if (!timezone || timezone.length > 100) return NextResponse.json({ error: 'Choose a valid timezone.' }, { status: 400 })

  const { data, error } = await supabase.rpc('create_organization_for_current_user', {
    p_name: name,
    p_industry: industry,
    p_website: website || null,
    p_timezone: timezone,
  })
  if (error) {
    console.error('[onboarding] organization creation failed:', { code: error.code, message: error.message, details: error.details, hint: error.hint })
    const normalizedError = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase()
    let message = 'We could not complete company setup. Please try again.'
    let status = 400
    if (normalizedError.includes('profile_not_found')) {
      message = 'Your profile is not ready yet. Please sign out and sign in again.'
    } else if (normalizedError.includes('function') && normalizedError.includes('does not exist')) {
      message = 'Company setup is not enabled for this workspace yet. Please contact your administrator.'
      status = 503
    } else if (normalizedError.includes('permission denied') || normalizedError.includes('not authorized')) {
      message = 'Company setup is not authorized for this account. Please contact your administrator.'
      status = 403
    } else if (normalizedError.includes('not_authenticated')) {
      message = 'Your session has expired. Please sign in again.'
      status = 401
    } else if (normalizedError.includes('invalid_company_name')) {
      message = 'Enter a company name between 1 and 120 characters.'
    } else if (normalizedError.includes('invalid_industry')) {
      message = 'Enter an industry between 1 and 120 characters.'
    } else if (normalizedError.includes('invalid_website')) {
      message = 'Enter a valid website URL beginning with http:// or https://.'
    } else if (normalizedError.includes('invalid_timezone')) {
      message = 'Choose a valid timezone.'
    }
    return NextResponse.json({ error: message, code: error.code ?? 'ONBOARDING_FAILED' }, { status })
  }
  return NextResponse.json({ organization: data })
}
