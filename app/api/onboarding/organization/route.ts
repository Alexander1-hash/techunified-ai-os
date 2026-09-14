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
    console.error('[onboarding] organization creation failed:', error.message)
    const message = error.message === 'profile_not_found' ? 'Your profile is not ready yet. Please sign out and sign in again.' : 'We could not complete company setup. Please try again.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
  return NextResponse.json({ organization: data })
}
