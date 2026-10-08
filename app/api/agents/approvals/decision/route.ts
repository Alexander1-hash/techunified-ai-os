import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'
import { executeAutomation } from '@/lib/automation/engine'

const MAX_REQUEST_BYTES = 64 * 1024
const MAX_REVIEWER_NOTE_CHARS = 2000

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: 'Approval request is too large.' }, { status: 413 })
  }

  const supabase = await createClient()
  const { profile } = await getCurrentProfile(supabase)
  const organizationId = profile?.organization_id
  const userId = profile?.id
  if (!organizationId || !userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

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
  const approvalId = typeof payload.approvalId === 'string' ? payload.approvalId.trim() : ''
  const decision = payload.decision === 'approved' || payload.decision === 'rejected' ? payload.decision : ''
  const reviewerNote = typeof payload.reviewerNote === 'string' ? payload.reviewerNote.trim() : ''

  if (reviewerNote.length > MAX_REVIEWER_NOTE_CHARS) return NextResponse.json({ error: 'Reviewer note is too long.' }, { status: 400 })
  if (approvalId.length > 200) return NextResponse.json({ error: 'Approval ID is too long.' }, { status: 400 })

  if (!approvalId || !decision) return NextResponse.json({ error: 'approvalId and a valid decision are required.' }, { status: 400 })

  const { data: approval } = await supabase
    .from('agent_approvals')
    .select('id,agent_run_id,status,action_type,proposed_action')
    .eq('id', approvalId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!approval) return NextResponse.json({ error: 'Approval request not found.' }, { status: 404 })
  if (approval.status !== 'pending') return NextResponse.json({ error: 'This approval is no longer pending.' }, { status: 409 })

  const proposedAction = approval.proposed_action && typeof approval.proposed_action === 'object'
    ? approval.proposed_action as Record<string, unknown>
    : {}

  const { data: linkedOrchestrationContext } = await supabase
    .from('business_orchestration_runs')
    .select('id,objective_id,plan')
    .eq('organization_id', organizationId)
    .contains('agent_run_ids', [approval.agent_run_id])
    .limit(1)
    .maybeSingle()

  const orchestrationPlan = linkedOrchestrationContext?.plan && typeof linkedOrchestrationContext.plan === 'object'
    ? linkedOrchestrationContext.plan as Record<string, unknown>
    : {}
  const decisionIntelligence = orchestrationPlan.decisionIntelligence && typeof orchestrationPlan.decisionIntelligence === 'object'
    ? orchestrationPlan.decisionIntelligence as Record<string, unknown>
    : null
  const workflowId = typeof proposedAction.workflowId === 'string' ? proposedAction.workflowId.trim() : ''
  const actionInput = proposedAction.input && typeof proposedAction.input === 'object' && !Array.isArray(proposedAction.input)
    ? proposedAction.input as Record<string, unknown>
    : {}

  if (decision === 'approved' && approval.action_type === 'workflow_execution' && !workflowId) {
    return NextResponse.json({ error: 'Approved workflow execution is missing workflowId.' }, { status: 400 })
  }

  if (decision === 'approved' && approval.action_type === 'workflow_execution') {
    const { data: workflowCheck } = await supabase
      .from('workflows')
      .select('id,status')
      .eq('id', workflowId)
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (!workflowCheck || String(workflowCheck.status).toLowerCase() !== 'active') {
      return NextResponse.json({ error: 'Approved workflow is no longer active.' }, { status: 409 })
    }
  }

  const { data: updatedApproval, error: updateError } = await supabase
    .from('agent_approvals')
    .update({
      status: decision,
      reviewed_by: userId,
      reviewer_note: reviewerNote || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', approvalId)
    .eq('organization_id', organizationId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (updateError) return NextResponse.json({ error: 'Unable to update approval.' }, { status: 500 })
  if (!updatedApproval) {
    return NextResponse.json({ error: 'This approval has already been reviewed.' }, { status: 409 })
  }

  const { error: runError } = await supabase
    .from('agent_runs')
    .update({ approval_status: decision })
    .eq('id', approval.agent_run_id)
    .eq('organization_id', organizationId)

  if (runError) return NextResponse.json({ error: 'Approval updated, but agent run state could not be synchronized.' }, { status: 500 })

  const approvalLesson = decision === 'rejected'
    ? 'Human reviewer rejected the proposed action. Do not treat this proposal as approved; reviewer note: ' + (reviewerNote || 'No reviewer note provided.')
    : 'Human reviewer approved the proposed action. Approval grants permission for the controlled path only; it does not itself prove business success.'

  const { data: agentRun } = await supabase
    .from('agent_runs')
    .select('agent_id')
    .eq('id', approval.agent_run_id)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (agentRun?.agent_id) {
    const { data: existingApprovalMemory } = await supabase.from('agent_memory')
      .select('id,memory_type,content,confidence,evidence_status,source_type,source_id')
      .eq('organization_id', organizationId)
      .eq('agent_id', agentRun.agent_id)
      .eq('source_type', 'human')
      .eq('source_id', approval.id)
      .eq('memory_type', 'lesson')
      .is('superseded_at', null)
      .limit(1)
      .maybeSingle()

    if (!existingApprovalMemory) {
      await supabase.from('agent_memory').insert({
        organization_id: organizationId,
        agent_id: agentRun.agent_id,
          run_id: approval.agent_run_id,
        memory_type: 'lesson',
        content: approvalLesson,
        importance: decision === 'rejected' ? 85 : 65,
        confidence: 100,
        evidence_status: 'explicit',
        source_type: 'human',
        source_id: approval.id,
          metadata: { approvalId: approval.id, decision, reviewerId: userId, reviewerNote: reviewerNote || null, decisionIntelligence },
      })
    }
  }

  if (decision === 'rejected' || approval.action_type !== 'workflow_execution') {
    return NextResponse.json({
      ok: true,
      approvalId,
      agentRunId: approval.agent_run_id,
      status: decision,
      execution: 'not_started',
      message: decision === 'rejected' ? 'Approval rejected. No execution was started.' : 'Proposal approved. No workflow execution was requested.',
    })
  }

  const { data: workflow } = await supabase
    .from('workflows')
    .select('id,name,status')
    .eq('id', workflowId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!workflow || String(workflow.status).toLowerCase() !== 'active') {
    // The workflow may be deactivated after the earlier preflight check. Do not
    // leave an approval marked approved when execution never started.
    const { error: approvalResetError } = await supabase
      .from('agent_approvals')
      .update({ status: 'pending', reviewed_by: null, reviewer_note: null, reviewed_at: null })
      .eq('id', approvalId)
      .eq('organization_id', organizationId)
      .eq('status', 'approved')

    const { error: runResetError } = await supabase
      .from('agent_runs')
      .update({ approval_status: 'pending' })
      .eq('id', approval.agent_run_id)
      .eq('organization_id', organizationId)

    if (approvalResetError || runResetError) {
      return NextResponse.json({
        error: 'Workflow is no longer active and approval state could not be restored. Please review the approval record.',
        execution: 'not_started',
      }, { status: 500 })
    }

    return NextResponse.json({
      error: 'Approved workflow is no longer active. Approval has been returned to pending.',
      approvalStatus: 'pending',
      execution: 'not_started',
    }, { status: 409 })
  }

  const { data: linkedOrchestrationsForGate } = await supabase
    .from('business_orchestration_runs')
    .select('id,objective_id,status')
    .eq('organization_id', organizationId)
    .contains('agent_run_ids', [approval.agent_run_id])

  for (const orchestration of linkedOrchestrationsForGate ?? []) {
    const { data: objectiveForGate } = await supabase
      .from('company_objectives')
      .select('id,title,status,dependencies,dependency_ids')
      .eq('id', orchestration.objective_id)
      .eq('organization_id', organizationId)
      .maybeSingle()

    const dependencyIds = Array.isArray(objectiveForGate?.dependencies)
      ? objectiveForGate.dependencies.filter((id: unknown): id is string => typeof id === 'string')
      : Array.isArray(objectiveForGate?.dependency_ids)
        ? objectiveForGate.dependency_ids.filter((id: unknown): id is string => typeof id === 'string')
        : []

    if (dependencyIds.length > 0) {
      const { data: dependencyObjectives } = await supabase
        .from('company_objectives')
        .select('id,title,status')
        .eq('organization_id', organizationId)
        .in('id', dependencyIds)

      const unresolved = dependencyIds
        .map((dependencyId: string) => ({
          dependencyId,
          objective: dependencyObjectives?.find((item) => String(item.id) === dependencyId),
        }))
        .filter(({ objective }) => !objective || String(objective.status ?? '').toLowerCase() !== 'completed')

      if (unresolved.length > 0) {
        // The approval was recorded before the final dependency gate. Restore its
        // pending state so the reviewer can retry after dependencies are resolved.
        const { error: approvalResetError } = await supabase
          .from('agent_approvals')
          .update({ status: 'pending', reviewed_by: null, reviewer_note: null, reviewed_at: null })
          .eq('id', approvalId)
          .eq('organization_id', organizationId)
          .eq('status', 'approved')

        const { error: runResetError } = await supabase
          .from('agent_runs')
          .update({ approval_status: 'pending' })
          .eq('id', approval.agent_run_id)
          .eq('organization_id', organizationId)

        if (approvalResetError || runResetError) {
          return NextResponse.json({
            error: 'Execution was blocked, but approval state could not be restored. Please review the approval record.',
            execution: 'not_started',
          }, { status: 500 })
        }

        const blockedDependencies = unresolved.map(({ dependencyId, objective }) => ({
          id: objective?.id ?? dependencyId,
          title: objective?.title ?? 'Unknown dependency',
          status: objective?.status ?? 'not_found',
        }))

        return NextResponse.json({
          error: 'Controlled execution blocked because an objective dependency is unresolved.',
          orchestrationRunId: orchestration.id,
          blockedDependencies,
          approvalStatus: 'pending',
          execution: 'not_started',
        }, { status: 409 })
      }
    }
  }

  const { data: actionRun, error: actionInsertError } = await supabase
    .from('business_action_runs')
    .insert({
      organization_id: organizationId,
      created_by: userId,
      decision_id: approval.agent_run_id,
      decision_type: 'agent_workflow_execution',
      decision_title: approval.action_type,
      workflow_id: workflow.id,
      status: 'running',
      input: actionInput,
      evidence: { approvalId, agentRunId: approval.agent_run_id, approvedBy: userId, decisionIntelligence },
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (actionInsertError || !actionRun) return NextResponse.json({ error: 'Unable to create controlled action run.' }, { status: 500 })

  const result = await executeAutomation(workflow.id, organizationId, {
    type: 'decision',
    input: {
      ...actionInput,
      agentRunId: approval.agent_run_id,
      approvalId,
      actionRunId: actionRun.id,
    },
  })

  if (!result.success) {
    const failedAt = new Date().toISOString()
    await supabase.from('business_action_runs').update({
      status: 'failed', execution_id: result.executionId ?? null,
      error_message: result.error ?? 'Automation execution failed.', completed_at: failedAt,
    }).eq('id', actionRun.id).eq('organization_id', organizationId)

    const { data: failedEvaluation } = await supabase.from('agent_evaluations')
      .select('evidence')
      .eq('run_id', approval.agent_run_id)
      .eq('organization_id', organizationId)
      .maybeSingle()
    const failedEvidence = failedEvaluation?.evidence && typeof failedEvaluation.evidence === 'object'
      ? failedEvaluation.evidence as Record<string, unknown>
      : {}
    await supabase.from('agent_evaluations').update({
      execution_success: false,
      outcome_linked: false,
      evidence: {
        ...failedEvidence,
        controlledActionExecution: 'failed',
        controlledActionRunId: actionRun.id,
        decisionIntelligence,
        executionId: result.executionId ?? null,
        executionError: result.error ?? 'Automation execution failed.',
        completedAt: failedAt,
      },
    }).eq('run_id', approval.agent_run_id).eq('organization_id', organizationId)

    const { data: failedOrchestrations } = await supabase
      .from('business_orchestration_runs')
      .select('id,objective_id,action_run_ids')
      .eq('organization_id', organizationId)
      .contains('agent_run_ids', [approval.agent_run_id])

    for (const orchestration of failedOrchestrations ?? []) {
      const actionRunIds = Array.isArray(orchestration.action_run_ids) ? orchestration.action_run_ids : []
      await supabase.from('business_orchestration_runs').update({
        status: 'failed',
        approval_status: 'approved',
        action_run_ids: Array.from(new Set([...actionRunIds, actionRun.id])),
        evidence: {
          controlledActionRunId: actionRun.id,
          executionId: result.executionId ?? null,
          executionStatus: 'failed',
          executionError: result.error ?? 'Automation execution failed.',
          approvalId,
          decisionIntelligence,
        },
        error_message: result.error ?? 'Automation execution failed.',
        completed_at: failedAt,
      }).eq('id', orchestration.id).eq('organization_id', organizationId)
    }

    return NextResponse.json({ ok: false, approvalId, agentRunId: approval.agent_run_id, actionRunId: actionRun.id, executionId: result.executionId ?? null, error: 'Controlled workflow execution failed. Review the action run for details.' }, { status: 500 })
  }

  const { data: completedAction, error: actionUpdateError } = await supabase
    .from('business_action_runs')
    .update({ status: 'completed', execution_id: result.executionId ?? null, output: result.output ?? {}, completed_at: new Date().toISOString() })
    .eq('id', actionRun.id)
    .eq('organization_id', organizationId)
    .select('id,workflow_id,execution_id,status,output,started_at,completed_at')
    .single()

  if (actionUpdateError) return NextResponse.json({ error: 'Workflow executed, but action evidence could not be finalized.' }, { status: 500 })

  const { data: linkedOutcome } = await supabase.from('business_outcomes')
    .select('id,evidence_status')
    .eq('organization_id', organizationId)
    .eq('action_run_id', actionRun.id)
    .in('evidence_status', ['measured', 'attributed'])
    .limit(1)
    .maybeSingle()

  const { data: completedEvaluation } = await supabase.from('agent_evaluations')
    .select('evidence')
    .eq('run_id', approval.agent_run_id)
    .eq('organization_id', organizationId)
    .maybeSingle()
  const completedEvidence = completedEvaluation?.evidence && typeof completedEvaluation.evidence === 'object'
    ? completedEvaluation.evidence as Record<string, unknown>
    : {}
  await supabase.from('agent_evaluations').update({
    execution_success: true,
    outcome_linked: Boolean(linkedOutcome),
    evidence: {
      ...completedEvidence,
      controlledActionExecution: 'completed',
      controlledActionRunId: actionRun.id,
      decisionIntelligence,
      executionId: result.executionId ?? null,
      linkedOutcomeId: linkedOutcome?.id ?? null,
      linkedOutcomeEvidenceStatus: linkedOutcome?.evidence_status ?? null,
      completedAt: completedAction.completed_at,
    },
  }).eq('run_id', approval.agent_run_id).eq('organization_id', organizationId)

  const { data: linkedOrchestrations } = await supabase
    .from('business_orchestration_runs')
    .select('id,objective_id,action_run_ids')
    .eq('organization_id', organizationId)
    .contains('agent_run_ids', [approval.agent_run_id])

  for (const orchestration of linkedOrchestrations ?? []) {
    const actionRunIds = Array.isArray(orchestration.action_run_ids) ? orchestration.action_run_ids : []
    await supabase.from('business_orchestration_runs').update({
      status: 'completed',
      approval_status: 'approved',
      action_run_ids: Array.from(new Set([...actionRunIds, actionRun.id])),
      evidence: {
        controlledActionRunId: actionRun.id,
        executionId: result.executionId ?? null,
        executionStatus: 'completed',
        approvalId,
        linkedOutcomeId: linkedOutcome?.id ?? null,
        linkedOutcomeEvidenceStatus: linkedOutcome?.evidence_status ?? null,
        decisionIntelligence,
      },
      result: {
        execution: 'completed',
        actionRunId: actionRun.id,
        executionId: result.executionId ?? null,
        linkedOutcomeId: linkedOutcome?.id ?? null,
        decisionIntelligence,
      },
      completed_at: completedAction.completed_at,
      error_message: null,
    }).eq('id', orchestration.id).eq('organization_id', organizationId)
  }

  return NextResponse.json({ ok: true, approvalId, agentRunId: approval.agent_run_id, status: 'approved', execution: 'completed', actionRun: completedAction, message: 'Approved workflow executed through the controlled Phase 1 action path.' })
}
