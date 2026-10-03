import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

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

  const body = await request.json().catch(() => null)
  const agentRunId = typeof body?.agentRunId === 'string' ? body.agentRunId.trim() : ''
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
  const proposedAction = body?.proposedAction && typeof body.proposedAction === 'object' ? body.proposedAction : {}
  const decisionEvidence = body?.decisionEvidence && typeof body.decisionEvidence === 'object' ? body.decisionEvidence : {}

  if (!agentRunId || !title) return NextResponse.json({ error: 'agentRunId and title are required.' }, { status: 400 })

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
