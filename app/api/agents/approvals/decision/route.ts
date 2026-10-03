import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { profile } = await getCurrentProfile(supabase)
  const organizationId = profile?.organization_id
  const userId = profile?.id
  if (!organizationId || !userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const approvalId = typeof body?.approvalId === 'string' ? body.approvalId.trim() : ''
  const decision = body?.decision === 'approved' || body?.decision === 'rejected' ? body.decision : ''
  const reviewerNote = typeof body?.reviewerNote === 'string' ? body.reviewerNote.trim() : ''

  if (!approvalId || !decision) return NextResponse.json({ error: 'approvalId and a valid decision are required.' }, { status: 400 })

  const { data: approval } = await supabase
    .from('agent_approvals')
    .select('id,agent_run_id,status,action_type,proposed_action')
    .eq('id', approvalId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!approval) return NextResponse.json({ error: 'Approval request not found.' }, { status: 404 })
  if (approval.status !== 'pending') return NextResponse.json({ error: 'This approval is no longer pending.' }, { status: 409 })

  const { error: updateError } = await supabase
    .from('agent_approvals')
    .update({
      status: decision,
      reviewed_by: userId,
      reviewer_note: reviewerNote || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', approvalId)
    .eq('organization_id', organizationId)

  if (updateError) return NextResponse.json({ error: 'Unable to update approval.' }, { status: 500 })

  const { error: runError } = await supabase
    .from('agent_runs')
    .update({ approval_status: decision })
    .eq('id', approval.agent_run_id)
    .eq('organization_id', organizationId)

  if (runError) return NextResponse.json({ error: 'Approval updated, but agent run state could not be synchronized.' }, { status: 500 })

  return NextResponse.json({
    ok: true,
    approvalId,
    agentRunId: approval.agent_run_id,
    status: decision,
    execution: 'not_started',
    message: decision === 'approved'
      ? 'Approval granted. Execution remains a separate controlled step.'
      : 'Approval rejected. No execution was started.',
  })
}
