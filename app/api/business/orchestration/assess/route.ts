import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'
import { runGovernedAgent } from '@/lib/agents/runtime'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { profile } = await getCurrentProfile(supabase)
    if (!profile?.id || !profile.organization_id) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const orchestrationRunId = typeof body?.orchestrationRunId === 'string' ? body.orchestrationRunId.trim() : ''
    if (!orchestrationRunId) return NextResponse.json({ error: 'orchestrationRunId is required.' }, { status: 400 })

    const { data: orchestration, error: orchestrationError } = await supabase
      .from('business_orchestration_runs')
      .select('id,objective_id,organization_id,status,plan,context_snapshot,agent_run_ids,action_run_ids')
      .eq('id', orchestrationRunId)
      .eq('organization_id', profile.organization_id)
      .maybeSingle()
    if (orchestrationError) throw orchestrationError
    if (!orchestration) return NextResponse.json({ error: 'Orchestration run not found.' }, { status: 404 })
    if (!['planning', 'awaiting_approval'].includes(orchestration.status)) return NextResponse.json({ error: 'This orchestration run is not available for assessment.' }, { status: 409 })

    const { data: objective, error: objectiveError } = await supabase
      .from('company_objectives')
      .select('*')
      .eq('id', orchestration.objective_id)
      .eq('organization_id', profile.organization_id)
      .maybeSingle()
    if (objectiveError) throw objectiveError
    if (!objective) return NextResponse.json({ error: 'Objective not found.' }, { status: 404 })

    const plan = orchestration.plan && typeof orchestration.plan === 'object' ? orchestration.plan as Record<string, unknown> : {}
    const decisionPackage = plan.decisionPackage && typeof plan.decisionPackage === 'object' ? plan.decisionPackage as Record<string, unknown> : null
    const blockedDependencies = decisionPackage?.blockedDependencies
    if (Array.isArray(blockedDependencies) && blockedDependencies.length > 0) {
      return NextResponse.json({
        error: 'Objective dependencies must be resolved before governed assessment.',
        blockedDependencies,
        execution: 'not_started',
      }, { status: 409 })
    }
    const recommended = plan.recommendedAgentTask && typeof plan.recommendedAgentTask === 'object' ? plan.recommendedAgentTask as Record<string, unknown> : null
    const agentId = typeof recommended?.agentId === 'string' ? recommended.agentId : ''
    if (!agentId) return NextResponse.json({ error: 'The objective plan has no grounded agent recommendation.' }, { status: 409 })

    const task = typeof recommended?.task === 'string' && recommended.task.trim()
      ? recommended.task.trim()
      : `Assess the company objective using available governed company context and identify measurable next steps. Objective: ${String(objective.title ?? objective.name ?? objective.description ?? 'Company objective')}`

    const result = await runGovernedAgent(agentId, task, profile.id)
    const existingAgentRunIds = Array.isArray(orchestration.agent_run_ids) ? orchestration.agent_run_ids : []
    const agentRunIds = Array.from(new Set([...existingAgentRunIds, result.runId]))

    const { data: approval } = await supabase
      .from('agent_approvals')
      .select('id,status,action_type,proposed_action,requested_at')
      .eq('organization_id', profile.organization_id)
      .eq('agent_run_id', result.runId)
      .eq('status', 'pending')
      .maybeSingle()

    const hasPendingApproval = result.approvalStatus === 'pending' || Boolean(approval)
    const nextStatus = hasPendingApproval ? 'awaiting_approval' : 'planning'
    const assessmentEvidence = {
      agentAssessmentRunId: result.runId,
      assessmentStatus: result.status,
      approvalStatus: hasPendingApproval ? 'pending' : 'not_required',
      approvalId: approval?.id ?? null,
      approvalActionType: approval?.action_type ?? null,
    }
    const decisionIntelligence = {
      objectiveId: orchestration.objective_id,
      assessmentRunId: result.runId,
      whyNow: decisionPackage?.recommendation ?? 'Run a governed assessment using the available company context.',
      blockers: Array.isArray(decisionPackage?.blockedDependencies) ? decisionPackage.blockedDependencies : [],
      evidenceBasis: {
        verifiedOutcomes: decisionPackage?.evidenceAvailable ?? 0,
        executionReady: decisionPackage?.executionReady ?? false,
        activeAgents: decisionPackage?.availableAgentCount ?? 0,
        activeWorkflows: decisionPackage?.availableWorkflowCount ?? 0,
      },
      approval: hasPendingApproval ? 'human_approval_required' : 'not_required_yet',
      execution: 'not_started',
      nextStep: hasPendingApproval
        ? 'Human review of the proposed controlled action is required before execution.'
        : 'Review the assessment and request controlled execution only when the proposed action is sufficiently grounded.',
    }

    const refinedPlan = {
      ...plan,
      decisionIntelligence,
      decisionPackage: decisionPackage
        ? {
            ...decisionPackage,
            assessmentRunId: result.runId,
            assessmentStatus: result.status,
            approvalRequired: hasPendingApproval,
            execution: 'not_started',
          }
        : null,
      assessment: {
        runId: result.runId,
        completed: result.status === 'completed',
        text: result.text,
        capturedAt: new Date().toISOString(),
      },
      proposedApproval: approval
        ? {
            approvalId: approval.id,
            actionType: approval.action_type,
            proposedAction: approval.proposed_action,
            status: approval.status,
            requestedAt: approval.requested_at,
          }
        : null,
      nextStep: hasPendingApproval
        ? 'Review the proposed action in the AI Workforce approval center before controlled execution.'
        : 'Review the assessment and refine the governed plan before requesting controlled execution.',
    }

    const { data: updated, error: updateError } = await supabase
      .from('business_orchestration_runs')
      .update({
        status: nextStatus,
        approval_status: hasPendingApproval ? 'pending' : 'not_required',
        agent_run_ids: agentRunIds,
        evidence: assessmentEvidence,
        plan: refinedPlan,
        result: { agentAssessment: result.text, approvalId: approval?.id ?? null, execution: 'not_started' },
      })
      .eq('id', orchestrationRunId)
      .eq('organization_id', profile.organization_id)
      .select('id,objective_id,status,approval_status,plan,agent_run_ids,evidence,result,updated_at')
      .single()
    if (updateError) throw updateError

    return NextResponse.json({ ok: true, orchestrationRun: updated, agentRun: result, execution: 'not_started' })
  } catch (error) {
    console.error('[Business Orchestration] assessment failed:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to assess objective.' }, { status: 500 })
  }
}
