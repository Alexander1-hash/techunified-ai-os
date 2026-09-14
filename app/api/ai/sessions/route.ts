import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, organizationId: null }
  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).maybeSingle()
  return { supabase, user, organizationId: profile?.organization_id ?? null }
}

export async function GET() {
  const { supabase, user, organizationId } = await getContext()
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })
  if (!organizationId) return NextResponse.json({ sessions: [] })
  const { data, error } = await supabase.from('ai_sessions').select('id, title, prompt, session_type, status, created_at, updated_at').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(20)
  if (error) return NextResponse.json({ error: 'Unable to load recent AI work.' }, { status: 500 })
  return NextResponse.json({ sessions: data ?? [] })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const prompt = body && typeof body.prompt === 'string' ? body.prompt.trim() : ''
  const sessionType = body && typeof body.sessionType === 'string' ? body.sessionType : 'session'
  if (!prompt) return NextResponse.json({ error: 'Describe what you want to move forward.' }, { status: 400 })
  if (prompt.length > 4000) return NextResponse.json({ error: 'Keep the request under 4,000 characters.' }, { status: 400 })
  const { supabase, user, organizationId } = await getContext()
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })
  if (!organizationId) return NextResponse.json({ error: 'Your profile is not connected to an organization.' }, { status: 422 })
  const title = prompt.length > 80 ? `${prompt.slice(0, 77)}…` : prompt
  const { data, error } = await supabase.from('ai_sessions').insert({ organization_id: organizationId, created_by: user.id, title, prompt, session_type: sessionType, status: 'pending' }).select('id, title, prompt, session_type, status, created_at, updated_at').single()
  if (error) return NextResponse.json({ error: 'Unable to create the AI session.' }, { status: 500 })
  await supabase.from('activity_logs').insert({ organization_id: organizationId, actor_id: user.id, event_type: 'ai_session.created', description: `Created AI session: ${title}`, metadata: { session_id: data.id, session_type: sessionType } })
  return NextResponse.json({ session: data }, { status: 201 })
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null)
  const id = body && typeof body.id === 'string' ? body.id : ''
  if (!id) return NextResponse.json({ error: 'Session id is required.' }, { status: 400 })
  const { supabase, user, organizationId } = await getContext()
  if (!user || !organizationId) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })
  const { data, error } = await supabase.from('ai_sessions').update({ status: body.status === 'failed' ? 'failed' : 'completed' }).eq('id', id).eq('organization_id', organizationId).select('id, status').maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'Unable to update the AI session.' }, { status: 500 })
  return NextResponse.json({ session: data })
}
