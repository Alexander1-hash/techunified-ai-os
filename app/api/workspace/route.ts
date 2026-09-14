import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })
  const { data: profile, error: profileError } = await supabase.from('profiles').select('organization_id').eq('id', user.id).maybeSingle()
  if (profileError || !profile?.organization_id) return NextResponse.json({ agents: 0, workflows: 0, knowledge: 0, activity: 0, sessions: [] })
  const organizationId = profile.organization_id
  const [agents, workflows, knowledge, activity, sessions] = await Promise.all([
    supabase.from('agents').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    supabase.from('workflows').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    supabase.from('knowledge_documents').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    supabase.from('ai_sessions').select('id, title, prompt, session_type, status, created_at, updated_at').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(8),
  ])
  const failure = [agents, workflows, knowledge, activity, sessions].find((result) => result.error)
  if (failure?.error) return NextResponse.json({ error: 'Unable to load workspace context.' }, { status: 500 })
  return NextResponse.json({ agents: agents.count ?? 0, workflows: workflows.count ?? 0, knowledge: knowledge.count ?? 0, activity: activity.count ?? 0, sessions: sessions.data ?? [] })
}
