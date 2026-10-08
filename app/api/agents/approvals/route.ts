import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

const MAX_REQUEST_BYTES = 64 * 1024
const MAX_TITLE_LENGTH = 200
const MAX_REASON_LENGTH = 2000

export async function GET() {
  const supabase = await createClient()
  const { profile } = await getCurrentProfile(supabase)
  if (!profile?.organization_id) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { data, error } = await supabase
    .from('agent_approvals')
    .select('id,agent_run_id,status,action_type,title,reason,proposed_action,decision_evidence,reviewer_note,requested_at,reviewed_at,created_at')
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: 'Unable to load agent approvals.' }, { status: 500 })
  return NextResponse.json({ approvals: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { profile } = await getCurrentProfile(supabase)
  const organizationId = profile?.organization_id
  const userId = profile?.id
  if (!organizationId || !userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: 'Approval request is too large.' }, { status: 413 })
  }

  const rawBody = await request.text()
  if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: 'Approval request is too large.' }, { status: 413 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Request body must be a JSON object.' }, { status: 400 })
  }

  const payload = body as Record<string, unknown>
  const agentRunId = typeof payload.agentRunId === 'string' ? payload.agentRunId.trim() : ''
  const title = typeof payload.title === 'string' ? payload.title.trim() : ''
  const reason = typeof payload.reason === 'string' ? payload.reason.trim() : ''
  const proposedAction: Record<string, unknown> = payload.proposedAction && typeof payload.proposedAction === 'object' && !Array.isArray(payload.proposedAction) ? payload.proposedAction as Record<string, unknown> : {}
  const decisionEvidence: Record<string, unknown> = payload.decisionEvidence && typeof payload.decisionEvidence === 'object' && !Array.isArray(payload.decisionEvidence) ? payload.decisionEvidence as Record<string, unknown> : {}

  if (!agentRunId || agentRunId.length > 200 || !title) {
    return NextResponse.json({ error: 'A valid agentRunId and title are required.' }, { status: 400 })
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return NextResponse.json({ error: 'Approval title is too long.' }, { status: 400 })
  }
  if (reason.length > MAX_REASON_LENGTH) {
    return NextResponse.json({ error: 'Approval reason is too long.' }, { status: 400 })
  }

  const { data: run } = await supabase
    .from('agent_runs')
    .select('id,agent_id,status,autonomy_mode,requires_approval,approval_status,result')
    .eq('id', agentRunId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!run) return NextResponse.json({ error: 'Agent run not found.' }, { status: 404 })
  if (!run.requires_approval) return NextResponse.json({ error: 'This run does not require approval.' }, { status: 409 })
  if (run.approval_status !== 'pending') return NextResponse.json({ error: 'This run is not awaiting approval.' }, { status: 409 })

  const { data: existing } = await supabase
    .from('agent_approvals')
    .select('id')
    .eq('agent_run_id', agentRunId)
    .eq('organization_id', organizationId)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) return NextResponse.json({ approval: existing, message: 'Approval already exists.' })

  const { data: approval, error } = await supabase
    .from('agent_approvals')
    .insert({
      organization_id: organizationId,
      agent_run_id: agentRunId,
      requested_by: userId,
      status: 'pending',
      action_type: proposedAction?.workflowId ? 'workflow_execution' : 'proposal',
      title,
      reason: reason || null,
      proposed_action: proposedAction,
      decision_evidence: decisionEvidence,
    })
    .select('id,agent_run_id,status,action_type,title,reason,proposed_action,decision_evidence,requested_at')
    .single()

  if (error) return NextResponse.json({ error: 'Unable to create approval request.' }, { status: 500 })

  return NextResponse.json({ approval }, { status: 201 })
}
