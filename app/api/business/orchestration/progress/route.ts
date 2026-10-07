import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { profile } = await getCurrentProfile(supabase)
    if (!profile?.organization_id) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const objectiveId = new URL(request.url).searchParams.get('objectiveId')?.trim()
    if (!objectiveId) return NextResponse.json({ error: 'objectiveId is required.' }, { status: 400 })

    const { data: objective, error: objectiveError } = await supabase
      .from('company_objectives')
      .select('*')
      .eq('id', objectiveId)
      .eq('organization_id', profile.organization_id)
      .maybeSingle()
    if (objectiveError) throw objectiveError
    if (!objective) return NextResponse.json({ error: 'Objective not found.' }, { status: 404 })

    const [{ data: runs, error: runsError }, { data: outcomes, error: outcomesError }, { data: evaluations, error: evaluationsError }] = await Promise.all([
      supabase
        .from('business_orchestration_runs')
        .select('id,status,approval_status,agent_run_ids,action_run_ids,evidence,result,plan,error_message,created_at,completed_at')
        .eq('organization_id', profile.organization_id)
        .eq('objective_id', objectiveId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('business_outcomes')
        .select('id,title,outcome_type,baseline_value,current_value,unit,hours_saved,cost_avoided,revenue_impact,evidence_status,action_run_id,created_at')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('agent_evaluations')
        .select('id,run_id,execution_success,outcome_linked,updated_at')
        .eq('organization_id', profile.organization_id)
        .order('updated_at', { ascending: false })
        .limit(200),
    ])
    if (runsError) throw runsError
    if (outcomesError) throw outcomesError
    if (evaluationsError) throw evaluationsError

    const actionRunIds = new Set(
      (runs ?? []).flatMap((run) => Array.isArray(run.action_run_ids) ? run.action_run_ids.filter((id): id is string => typeof id === 'string') : []),
    )
    const allActionRuns = [...actionRunIds]
    const linkedOutcomes = (outcomes ?? []).filter((outcome) => typeof outcome.action_run_id === 'string' && actionRunIds.has(outcome.action_run_id))
    const verifiedOutcomes = linkedOutcomes.filter((outcome) => ['measured', 'attributed'].includes(String(outcome.evidence_status)))
    const completedRuns = (runs ?? []).filter((run) => run.status === 'completed').length
    const failedRuns = (runs ?? []).filter((run) => run.status === 'failed').length
    const activeRuns = (runs ?? []).filter((run) => ['planning', 'awaiting_approval', 'executing'].includes(run.status)).length
    const awaitingApprovalRuns = (runs ?? []).filter((run) => run.status === 'awaiting_approval' || run.approval_status === 'pending').length
    const latestFailedRun = (runs ?? []).find((run) => run.status === 'failed') ?? null
    const latestVerifiedOutcome = verifiedOutcomes[0] ?? null
    const latestDecisionIntelligence = (runs ?? []).find((run) => run.plan?.decisionIntelligence)?.plan?.decisionIntelligence ?? null
    const evidenceConfidence = verifiedOutcomes.length > 0 ? 'high' : runs?.some((run) => run.status === 'completed') ? 'medium' : runs?.some((run) => Array.isArray(run.agent_run_ids) && run.agent_run_ids.length > 0) ? 'medium' : 'low'
    const relationshipRows = (runs ?? []).flatMap((run) => {
      const relationshipEvidence = run.plan?.relationshipEvidence
      return relationshipEvidence && typeof relationshipEvidence === 'object' ? [relationshipEvidence] : []
    })
    const relationshipEvidence = relationshipRows[0] ?? null

    const objectiveIndex = new Map<string, any>()
    const explicitDependencies = Array.isArray(objective.dependencies)
      ? objective.dependencies
      : Array.isArray(objective.dependency_ids)
        ? objective.dependency_ids
        : []
    const dependencyIds = explicitDependencies.filter((id: any): id is string => typeof id === 'string')
    if (dependencyIds.length > 0) {
      const { data: dependencyObjectives, error: dependencyError } = await supabase
        .from('company_objectives')
        .select('id,title,name,description')
        .eq('organization_id', profile.organization_id)
        .in('id', dependencyIds)
      if (dependencyError) throw dependencyError
      for (const dependency of dependencyObjectives ?? []) objectiveIndex.set(String(dependency.id), dependency)
    }
    const dependencyDetails: Array<{ id: string; title: string; status: string; exists: boolean; completed: boolean; failed: boolean; runCount: number }> = dependencyIds.map((dependencyId: string) => {
      const dependencyObjective = objectiveIndex.get(dependencyId)
      return {
        id: dependencyId,
        title: dependencyObjective ? String(dependencyObjective.title ?? dependencyObjective.name ?? dependencyObjective.description ?? 'Objective') : 'Unknown objective',
        status: dependencyObjective ? 'unresolved' : 'missing',
        exists: Boolean(dependencyObjective),
        completed: false,
        failed: false,
        runCount: 0,
      }
    })

    if (dependencyIds.length > 0) {
      const { data: dependencyRuns, error: dependencyRunsError } = await supabase
        .from('business_orchestration_runs')
        .select('objective_id,status')
        .eq('organization_id', profile.organization_id)
        .in('objective_id', dependencyIds)
        .limit(200)
      if (dependencyRunsError) throw dependencyRunsError
      for (const dependency of dependencyDetails) {
        const relatedRuns = (dependencyRuns ?? []).filter((run) => String(run.objective_id) === dependency.id)
        dependency.runCount = relatedRuns.length
        dependency.failed = relatedRuns.some((run) => run.status === 'failed')
        dependency.completed = relatedRuns.some((run) => run.status === 'completed')
        dependency.status = dependency.failed ? 'failed' : dependency.completed ? 'completed' : dependency.exists ? 'unresolved' : 'missing'
      }
    }
    const blockedDependencies = dependencyDetails.filter((dependency: { status: string }) => dependency.status !== 'completed')

    const objectiveAgentRunIds = new Set(
      (runs ?? []).flatMap((run) => Array.isArray(run.agent_run_ids) ? run.agent_run_ids.filter((id): id is string => typeof id === 'string') : []),
    )
    const objectiveEvaluations = (evaluations ?? []).filter((evaluation) => typeof evaluation.run_id === 'string' && objectiveAgentRunIds.has(evaluation.run_id))
    const successfulEvaluations = objectiveEvaluations.filter((evaluation) => evaluation.execution_success === true)
    const failedEvaluations = objectiveEvaluations.filter((evaluation) => evaluation.execution_success === false)
    const learningSignal = successfulEvaluations.length > 0 && verifiedOutcomes.length > 0
      ? 'positive_verified_learning'
      : failedEvaluations.length > 0
        ? 'negative_execution_learning'
        : objectiveEvaluations.length > 0
          ? 'evaluated_no_verified_outcome'
          : 'no_learning_signal'

    let decisionRecommendation = 'Start a governed orchestration assessment for this objective.'
    let decisionReason = 'No active objective work or verified outcome evidence is currently available.'
    let decisionEvidence = 'objective_record'
    let nextMoveAction = 'start_governed_assessment'

    if (awaitingApprovalRuns > 0) {
      decisionRecommendation = 'Review the pending human approval before initiating any controlled workflow execution.'
      decisionReason = 'The objective has governed work waiting at the human approval boundary.'
      decisionEvidence = 'pending_approval'
      nextMoveAction = 'resolve_approval'
    } else if (failedRuns > 0) {
      decisionRecommendation = 'Investigate the latest failed orchestration before starting another execution.'
      decisionReason = 'Objective orchestration has failed and requires review before new governed work.'
      decisionEvidence = 'failed_orchestration'
      nextMoveAction = 'investigate_failure'
    } else if (blockedDependencies.length > 0) {
      decisionRecommendation = 'Resolve the objective dependencies before starting another governed assessment.'
      decisionReason = 'One or more required objective dependencies are not completed.'
      decisionEvidence = 'dependency_blocker'
      nextMoveAction = 'resolve_dependency'
    } else if (activeRuns > 0) {
      decisionRecommendation = 'Continue the active governed orchestration and resolve any pending approval before duplicating work.'
      decisionReason = 'Governed work is already active for this objective.'
      decisionEvidence = 'active_orchestration'
      nextMoveAction = 'continue_active_work'
    } else if (learningSignal === 'negative_execution_learning') {
      decisionRecommendation = 'Review the prior execution learning before starting another governed assessment.'
      decisionReason = 'A prior agent evaluation indicates execution risk or an unsuccessful result for this objective.'
      decisionEvidence = 'negative_execution_learning'
      nextMoveAction = 'review_learning_signal'
    } else if (latestVerifiedOutcome) {
      decisionRecommendation = 'Compare the verified outcome with the objective target and choose the next measurable intervention.'
      decisionReason = 'Verified outcome evidence exists and can now inform the next objective decision.'
      decisionEvidence = 'verified_outcome'
      nextMoveAction = 'review_verified_outcome'
    } else if (evidenceConfidence === 'medium') {
      decisionRecommendation = 'Strengthen objective evidence before starting another governed execution path.'
      decisionReason = 'The objective has assessment or completed-work evidence, but no verified business outcome is attached yet.'
      decisionEvidence = 'medium_confidence_evidence'
      nextMoveAction = 'strengthen_evidence'
    }

    const target = objective.target_value ?? objective.target ?? null
    const current = objective.current_value ?? objective.current ?? null
    let progressPercent: number | null = null
    if (typeof target === 'number' && typeof current === 'number' && target !== 0) {
      progressPercent = Math.max(0, Math.min(100, (current / target) * 100))
    }

    return NextResponse.json({
      ok: true,
      objective: {
        id: objective.id,
        title: String(objective.title ?? objective.name ?? objective.description ?? 'Company objective'),
        description: String(objective.description ?? objective.details ?? ''),
        target,
        current,
        metric: objective.metric ?? objective.metric_name ?? objective.key_result ?? null,
      },
      progress: {
        percent: progressPercent,
        orchestrationRuns: runs?.length ?? 0,
        activeRuns,
        completedRuns,
        failedRuns,
        linkedOutcomes: linkedOutcomes.length,
        verifiedOutcomes: verifiedOutcomes.length,
        remainingGap: progressPercent == null ? null : Math.max(0, 100 - progressPercent),
        awaitingApprovalRuns,
        governedActionRuns: allActionRuns.length,
        evidenceConfidence,
        relationshipEvidence,
      },
      decisionIntelligence: {
        recommendation: latestDecisionIntelligence?.whyNow ?? decisionRecommendation,
        reason: latestDecisionIntelligence
          ? (Array.isArray(latestDecisionIntelligence.blockers) && latestDecisionIntelligence.blockers.length > 0
              ? `Persisted governed decision intelligence identifies ${latestDecisionIntelligence.blockers.length} blocker(s).`
              : 'Persisted governed decision intelligence is available from the latest assessed orchestration.')
          : decisionReason,
        evidence: latestDecisionIntelligence?.evidenceBasis
          ? `verified_outcomes:${String(latestDecisionIntelligence.evidenceBasis.verifiedOutcomes ?? 0)}`
          : decisionEvidence,
        grounded: true,
        execution: latestDecisionIntelligence?.execution ?? 'not_started',
        approval: latestDecisionIntelligence?.approval ?? 'not_required_yet',
        blockers: Array.isArray(latestDecisionIntelligence?.blockers) ? latestDecisionIntelligence.blockers : blockedDependencies.map((dependency: { id: string }) => dependency.id),
        latestFailedRunId: latestFailedRun?.id ?? null,
        latestVerifiedOutcomeId: latestVerifiedOutcome?.id ?? null,
        prioritySignals: {
          activeWork: activeRuns,
          pendingApproval: awaitingApprovalRuns,
          failedWork: failedRuns,
          verifiedOutcomes: verifiedOutcomes.length,
          evidenceGap: completedRuns > 0 && verifiedOutcomes.length === 0,
          evidenceConfidence,
          learningSignal,
          evaluatedRuns: objectiveEvaluations.length,
          successfulEvaluations: successfulEvaluations.length,
          failedEvaluations: failedEvaluations.length,
          blockedDependencies: blockedDependencies.length,
          nextMoveAction,
        },
      },
      dependencies: dependencyDetails,
      outcomes: linkedOutcomes.slice(0, 20),
      nextMove: {
        action: nextMoveAction,
        objectiveId: objective.id,
        reason: decisionReason,
        evidence: decisionEvidence,
        blockerCount: blockedDependencies.length,
        learningSignal,
        approval: latestDecisionIntelligence?.approval ?? (awaitingApprovalRuns > 0 ? 'human_approval_required' : 'not_required_yet'),
        execution: latestDecisionIntelligence?.execution ?? 'not_started',
      },
      nextRecommendedMove: decisionRecommendation,
      nextMoveAction,
    })
  } catch (error) {
    console.error('[Business Orchestration] progress failed:', error)
    return NextResponse.json({ error: 'Unable to calculate objective progress.' }, { status: 500 })
  }
}
