import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

const allowedStatuses = [
  'planning',
  'awaiting_approval',
  'executing',
  'completed',
  'failed',
  'cancelled',
] as const

const allowedApprovalStatuses = [
  'not_required',
  'pending',
  'approved',
  'rejected',
] as const

async function getContext() {
  const supabase = await createClient()
  const { profile } = await getCurrentProfile(supabase)

  return {
    supabase,
    userId: profile?.id ?? null,
    organizationId: profile?.organization_id ?? null,
  }
}

export async function GET(request: Request) {
  try {
    const { supabase, organizationId } = await getContext()

    if (!organizationId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const url = new URL(request.url)
    const objectiveId = url.searchParams.get('objectiveId')?.trim() || null

    let query = supabase
      .from('business_orchestration_runs')
      .select(
        'id,objective_id,initiated_by,lead_agent_id,status,approval_status,plan,context_snapshot,agent_run_ids,action_run_ids,evidence,result,error_message,started_at,completed_at,created_at,updated_at',
      )
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (objectiveId) query = query.eq('objective_id', objectiveId)

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ ok: true, orchestrationRuns: data ?? [] })
  } catch (error) {
    console.error('[Business Orchestration] GET failed:', error)
    return NextResponse.json({ error: 'Unable to load orchestration runs.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId, organizationId } = await getContext()

    if (!organizationId || !userId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const objectiveId = typeof body?.objectiveId === 'string' ? body.objectiveId.trim() : ''

    if (!objectiveId) {
      return NextResponse.json({ error: 'objectiveId is required.' }, { status: 400 })
    }

    const { data: objective, error: objectiveError } = await supabase
      .from('company_objectives')
      .select('*')
      .eq('id', objectiveId)
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (objectiveError) throw objectiveError

    if (!objective) {
      return NextResponse.json({ error: 'Objective not found.' }, { status: 404 })
    }

    const leadAgentId =
      typeof body?.leadAgentId === 'string' && body.leadAgentId.trim()
        ? body.leadAgentId.trim()
        : null

    if (leadAgentId) {
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('id,name,status,autonomy_level')
        .eq('id', leadAgentId)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (agentError) throw agentError

      if (!agent) {
        return NextResponse.json({ error: 'Lead agent not found.' }, { status: 404 })
      }
    }

    const [{ data: agents, error: agentsError }, { data: workflows, error: workflowsError }, { data: relationshipRows, error: relationshipError }] = await Promise.all([
      supabase.from('agents').select('id,name,purpose,description,status,autonomy_level,model').eq('organization_id', organizationId).in('status', ['active', 'running']).limit(50),
      supabase.from('workflows').select('id,name,description,status').eq('organization_id', organizationId).eq('status', 'active').limit(50),
      supabase.from('business_relationships').select('source_type,source_id,relationship_type,target_type,target_id,evidence_status,confidence').eq('organization_id', organizationId).limit(500),
    ])

    if (agentsError) throw agentsError
    if (workflowsError) throw workflowsError
    if (relationshipError) throw relationshipError

    const { data: recentAgentRuns, error: agentRunsError } = await supabase
      .from('agent_runs')
      .select('id,agent_id,task,status,autonomy_mode,approval_status,created_at,completed_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (agentRunsError) throw agentRunsError

    const { data: recentActionRuns, error: actionRunsError } = await supabase
      .from('business_action_runs')
      .select('id,decision_id,decision_type,decision_title,workflow_id,status,execution_id,created_at,completed_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (actionRunsError) throw actionRunsError

    const { data: recentOutcomes, error: outcomesError } = await supabase
      .from('business_outcomes')
      .select('id,title,outcome_type,baseline_value,current_value,unit,hours_saved,cost_avoided,revenue_impact,evidence_status,action_run_id,period_start,period_end,created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (outcomesError) throw outcomesError

    const objectiveTitle = String(objective.title ?? objective.name ?? objective.description ?? 'Company objective')
    const objectiveDescription = String(objective.description ?? objective.details ?? '')
    const objectiveTarget = objective.target_value ?? objective.target ?? null
    const objectiveMetric = objective.metric ?? objective.metric_name ?? objective.key_result ?? null
    const relationships = relationshipRows ?? []
    const verifiedRelationships = relationships.filter((row: any) => String(row.evidence_status) === 'verified').length
    const estimatedRelationships = relationships.filter((row: any) => String(row.evidence_status) === 'estimated').length
    const inferredRelationships = relationships.filter((row: any) => String(row.evidence_status) === 'inferred').length
    const relationshipCoverage = relationships.length > 0 ? Math.round((verifiedRelationships / relationships.length) * 100) : null

    const contextSnapshot = {
      objective,
      recentAgentRuns: recentAgentRuns ?? [],
      recentActionRuns: recentActionRuns ?? [],
      recentOutcomes: recentOutcomes ?? [],
      relationshipEvidence: {
        explicitRelationships: relationships.length,
        verifiedRelationships,
        verifiedCoveragePercent: relationshipCoverage,
        estimatedRelationships,
        inferredRelationships,
        methodology: 'Relationship evidence is contextual planning evidence. It does not establish causation, profitability, ROI, or business impact by itself.',
      },
      agentLearning: learningEvidence,
      availableAgents: agents ?? [],
      activeWorkflows: workflows ?? [],
      orchestrationRule:
        'Coordinate existing governed AI workers and controlled actions. Never bypass approval, workflow validation, execution evidence, or learning controls.',
    }

    const { data: activeObjectiveRuns, error: activeRunsError } = await supabase
      .from('business_orchestration_runs')
      .select('id,status,approval_status,created_at')
      .eq('organization_id', organizationId)
      .eq('objective_id', objectiveId)
      .in('status', ['planning', 'awaiting_approval', 'executing'])
      .order('created_at', { ascending: false })
      .limit(10)

    if (activeRunsError) throw activeRunsError

    if ((activeObjectiveRuns?.length ?? 0) > 0) {
      const existing = activeObjectiveRuns[0]
      return NextResponse.json({
        error: 'This objective already has active governed orchestration work.',
        existingOrchestrationRunId: existing.id,
        existingStatus: existing.status,
        approvalStatus: existing.approval_status,
        execution: 'not_started',
      }, { status: 409 })
    }

    const dependencyIds = Array.isArray(objective.dependencies)
      ? objective.dependencies.filter((id: unknown): id is string => typeof id === 'string')
      : Array.isArray(objective.dependency_ids)
        ? objective.dependency_ids.filter((id: unknown): id is string => typeof id === 'string')
        : []

    const dependencyStatuses = dependencyIds.length
      ? (await supabase.from('company_objectives').select('id,title,status').eq('organization_id', organizationId).in('id', dependencyIds)).data ?? []
      : []

    const blockedDependencies: Array<{ id: string; title: string; status: string }> = []
    for (const dependencyId of dependencyIds) {
      const dependency = dependencyStatuses.find((item) => String(item.id) === dependencyId)
      if (!dependency || String(dependency.status ?? '').toLowerCase() !== 'completed') {
        blockedDependencies.push({
          id: dependency?.id ?? dependencyId,
          title: dependency?.title ?? 'Unknown dependency',
          status: dependency?.status ?? 'not_found',
        })
      }
    }

    const candidateAgent = agents?.[0] ?? null
    const candidateWorkflow = workflows?.[0] ?? null

    const [{ data: agentEvaluations, error: agentEvaluationsError }, { data: agentMemories, error: agentMemoriesError }] = candidateAgent
      ? await Promise.all([
          supabase.from('agent_evaluations').select('groundedness_score,tool_accuracy_score,execution_success,outcome_linked,created_at').eq('organization_id', organizationId).eq('agent_id', candidateAgent.id).order('created_at', { ascending: false }).limit(10),
          supabase.from('agent_memory').select('content,confidence,evidence_status,source_type,created_at').eq('organization_id', organizationId).eq('agent_id', candidateAgent.id).is('superseded_at', null).order('confidence', { ascending: false }).order('importance', { ascending: false }).order('created_at', { ascending: false }).limit(20),
        ])
      : [{ data: [], error: null }, { data: [], error: null }]

    if (agentEvaluationsError) throw agentEvaluationsError
    if (agentMemoriesError) throw agentMemoriesError

    const evaluations = agentEvaluations ?? []
    const memories = agentMemories ?? []
    const durableLearning = memories.filter((memory: any) => ['verified', 'attributed', 'explicit'].includes(String(memory.evidence_status)))
    const learningEvidence = {
      evaluationCount: evaluations.length,
      averageGroundedness: (() => {
        const values = evaluations.map((item: any) => item.groundedness_score).filter((value: unknown): value is number => typeof value === 'number')
        return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null
      })(),
      averageToolAccuracy: (() => {
        const values = evaluations.map((item: any) => item.tool_accuracy_score).filter((value: unknown): value is number => typeof value === 'number')
        return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null
      })(),
      failedEvaluations: evaluations.filter((item: any) => item.execution_success === false).length,
      outcomeLinkedEvaluations: evaluations.filter((item: any) => item.outcome_linked === true).length,
      durableMemoryCount: durableLearning.length,
      durableLessons: durableLearning.slice(0, 5).map((memory: any) => ({ content: memory.content, evidenceStatus: memory.evidence_status, confidence: memory.confidence, sourceType: memory.source_type })),
      methodology: 'Durable learning is limited to explicit human feedback or verified/attributed evidence; unverified memory remains contextual.',
    }
    const executionReady = Boolean(candidateAgent && candidateWorkflow)
    const decisionPackage = {
      objective: { id: objectiveId, title: objectiveTitle, target: objectiveTarget, metric: objectiveMetric },
      workload: 'available',
      blockedDependencies,
      executionReady,
      availableAgentCount: agents?.length ?? 0,
      availableWorkflowCount: workflows?.length ?? 0,
      evidenceAvailable: recentOutcomes?.filter((outcome) => ['measured', 'attributed'].includes(String(outcome.evidence_status))).length ?? 0,
      relationshipEvidence: {
        explicitRelationships: relationships.length,
        verifiedRelationships,
        verifiedCoveragePercent: relationshipCoverage,
        estimatedRelationships,
        inferredRelationships,
      },
      agentLearning: learningEvidence,
      recommendation: blockedDependencies.length > 0
        ? 'Resolve objective dependencies before assessment or execution.'
        : candidateAgent
          ? 'Run the recommended governed AI assessment.'
          : 'Activate an appropriate AI worker before assessment.',
      execution: 'not_started',
      governance: 'human approval remains required for consequential controlled actions',
    }
    const plan =
      body?.plan && typeof body.plan === 'object' && !Array.isArray(body.plan)
        ? body.plan
        : {
            mode: 'objective_intelligence',
            execution: 'not_started',
            grounded: true,
            objective: { title: objectiveTitle, description: objectiveDescription, target: objectiveTarget, metric: objectiveMetric },
            facts: [
              `Objective record: ${objectiveTitle}`,
              `Available active/running agents: ${agents?.length ?? 0}`,
              `Available active workflows: ${workflows?.length ?? 0}`,
              `Recent business outcomes available: ${recentOutcomes?.length ?? 0}`,
              `Verified relationship evidence: ${verifiedRelationships} of ${relationships.length} explicit relationships`,
              `Candidate agent durable learning: ${learningEvidence.durableMemoryCount} lessons; outcome-linked evaluations: ${learningEvidence.outcomeLinkedEvaluations}`,
            ],
            gaps: [
              ...(agents?.length ? [] : ['No active AI worker is available for objective coordination.']),
              ...(workflows?.length ? [] : ['No active workflow is available for controlled execution.']),
              ...(objectiveTarget == null ? ['Objective has no explicit target value in the available record.'] : []),
              ...(relationships.length > 0 && verifiedRelationships < relationships.length ? ['Some relationship evidence is not verified; orchestration should not treat it as established business causation.'] : []),
              ...(learningEvidence.failedEvaluations > 0 ? ['Candidate agent has prior failed evaluations; review durable learning before repeating similar work.'] : []),
            ],
            recommendedAgentTask: candidateAgent
              ? { agentId: candidateAgent.id, agentName: candidateAgent.name, task: `Assess the objective “${objectiveTitle}” using available company context and return measurable next steps.` }
              : null,
            proposedWorkflowAction: candidateWorkflow
              ? { workflowId: candidateWorkflow.id, workflowName: candidateWorkflow.name, approvalRequired: true, execution: 'not_started' }
              : null,
            dependencies: ['Existing company data/context', ...(candidateAgent ? ['Governed AI worker'] : []), ...(candidateWorkflow ? ['Approved workflow'] : [])],
            risks: ['Insufficient evidence may produce an incomplete plan.', 'Consequential workflow execution requires human approval.', 'No execution is performed during planning.'],
            successEvidence: ['Objective progress against its defined target/metric', 'Completed action evidence where an approved workflow is executed', 'Measured or attributed business outcome linked to the action run'],
            nextStep: candidateAgent ? 'Run the recommended governed agent assessment.' : 'Add or activate an appropriate AI worker before execution planning.',
            decisionPackage,
          }

    const { data, error } = await supabase
      .from('business_orchestration_runs')
      .insert({
        organization_id: organizationId,
        objective_id: objectiveId,
        initiated_by: userId,
        lead_agent_id: leadAgentId,
        status: 'planning',
        approval_status: 'not_required',
        plan,
        context_snapshot: contextSnapshot,
      })
      .select(
        'id,objective_id,initiated_by,lead_agent_id,status,approval_status,plan,context_snapshot,agent_run_ids,action_run_ids,evidence,result,error_message,started_at,completed_at,created_at,updated_at',
      )
      .single()

    if (error) throw error

    return NextResponse.json(
      {
        ok: true,
        orchestrationRun: data,
        message:
          'Objective orchestration record created. No agent, workflow, or external action was executed by this request.',
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('[Business Orchestration] POST failed:', error)
    return NextResponse.json({ error: 'Unable to create orchestration run.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, organizationId } = await getContext()

    if (!organizationId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const id = typeof body?.id === 'string' ? body.id.trim() : ''

    if (!id) {
      return NextResponse.json({ error: 'orchestration run id is required.' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}

    if (typeof body?.status === 'string') {
      if (!allowedStatuses.includes(body.status as (typeof allowedStatuses)[number])) {
        return NextResponse.json({ error: 'Invalid orchestration status.' }, { status: 400 })
      }
      updates.status = body.status
      if (body.status === 'executing' && !body.started_at) updates.started_at = new Date().toISOString()
      if (['completed', 'failed', 'cancelled'].includes(body.status) && !body.completed_at) {
        updates.completed_at = new Date().toISOString()
      }
    }

    if (typeof body?.approval_status === 'string') {
      if (!allowedApprovalStatuses.includes(body.approval_status as (typeof allowedApprovalStatuses)[number])) {
        return NextResponse.json({ error: 'Invalid orchestration approval status.' }, { status: 400 })
      }
      updates.approval_status = body.approval_status
    }

    for (const field of ['plan', 'evidence', 'result', 'agent_run_ids', 'action_run_ids']) {
      if (body && field in body) {
        updates[field] = body[field]
      }
    }

    if (typeof body?.error_message === 'string') {
      updates.error_message = body.error_message.trim() || null
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: 'No orchestration changes supplied.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('business_orchestration_runs')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select(
        'id,objective_id,initiated_by,lead_agent_id,status,approval_status,plan,context_snapshot,agent_run_ids,action_run_ids,evidence,result,error_message,started_at,completed_at,created_at,updated_at',
      )
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, orchestrationRun: data })
  } catch (error) {
    console.error('[Business Orchestration] PATCH failed:', error)
    return NextResponse.json({ error: 'Unable to update orchestration run.' }, { status: 500 })
  }
}
