import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).maybeSingle()
  if (!profile?.organization_id) return NextResponse.json({ error: 'Organization not found.' }, { status: 422 })
  const { data, error } = await supabase.from('ai_sessions').select('id, title, prompt, session_type, status, created_at, updated_at').eq('id', id).eq('organization_id', profile.organization_id).maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
  return NextResponse.json({ session: data })
}
