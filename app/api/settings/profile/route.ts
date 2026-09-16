import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const urlPattern = /^https?:\/\/[^\s]+$/i

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in to continue.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const fullName = typeof body?.full_name === 'string' ? body.full_name.trim() : ''
  const avatarUrl = typeof body?.avatar_url === 'string' ? body.avatar_url.trim() : ''

  if (!fullName || fullName.length > 120) return NextResponse.json({ error: 'Enter a name between 1 and 120 characters.' }, { status: 400 })
  if (avatarUrl && (!urlPattern.test(avatarUrl) || avatarUrl.length > 500)) {
    return NextResponse.json({ error: 'Enter a valid image URL beginning with http:// or https://.' }, { status: 400 })
  }

  // RLS ensures a user can only update their own row (profiles_update_own).
  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: fullName, avatar_url: avatarUrl || null })
    .eq('id', user.id)
    .select('id, full_name, avatar_url, role, organization_id')
    .single()

  if (error) {
    console.error('[settings/profile] update failed:', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'We could not save your profile. Please try again.' }, { status: 400 })
  }
  return NextResponse.json({ profile: data })
}
