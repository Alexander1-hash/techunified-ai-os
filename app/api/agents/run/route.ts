import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runGovernedAgent } from '@/lib/agents/runtime'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).maybeSingle()
  if (!profile?.organization_id) return NextResponse.json({ error: 'Organization required.' }, { status: 400 })

  const url = new URL(request.url)
  const agentId = url.searchParams.get('agentId')?.trim()
  if (!agentId) return NextResponse.json({ error: 'agentId is required.' }, { status: 400 })

  const { data, error } = await supabase
    .from('agent_runs')
    .select('id,agent_id,task,status,autonomy_mode,requires_approval,approval_status,tool_calls,result,error_message,started_at,completed_at,created_at,updated_at')
    .eq('organization_id', profile.organization_id)
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: 'Unable to load agent runs.' }, { status: 500 })
  return NextResponse.json({ runs: data ?? [] })
}

export async function POST(request: Request) {
  const MAX_REQUEST_BYTES = 64 * 1024;
  const contentLength = Number(request.headers.get('content-length') ?? '0');

  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: 'Request body is too large.' }, { status: 413 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: 'Request body is too large.' }, { status: 413 })
  }
  const body = JSON.parse(rawBody) as { agentId?: string; task?: string }
  const agentId = body?.agentId?.trim()
  const task = body?.task?.trim()

  if (!agentId || !task) return NextResponse.json({ error: 'agentId and task are required.' }, { status: 400 })
  if (agentId.length > 200) return NextResponse.json({ error: 'agentId is too long.' }, { status: 400 })
  if (task.length > 8000) return NextResponse.json({ error: 'Task is too long.' }, { status: 400 })

  try {
    const result = await runGovernedAgent(agentId, task, user.id)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to run agent.' },
      { status: 500 },
    )
  }
}
