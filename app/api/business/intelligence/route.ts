import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

export async function GET() {
  try {
    const supabase = await createClient()
    const { profile } = await getCurrentProfile(supabase)
    if (!profile?.organization_id) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    const organizationId = profile.organization_id

    const [{ data: objectives }, { data: runs }, { data: outcomes }, { data: agents }, { data: workflows }, { data: evaluations }] = await Promise.all([
      supabase.from('company_objectives').select('id,status,target_value,current_value').eq('organization_id', organizationId).limit(200),
      supabase.from('business_orchestration_runs').select('id,objective_id,status,approval_status,created_at').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(300),
      supabase.from('business_outcomes').select('id,action_run_id,evidence_status,hours_saved,cost_avoided,revenue_impact').eq('organization_id', organizationId).limit(300),
      supabase.from('agents').select('id,status').eq('organization_id', organizationId).in('status', ['active', 'running']).limit(100),
      supabase.from('workflows').select('id,status').eq('organization_id', organizationId).eq('status', 'active').limit(100),
      supabase.from('agent_evaluations').select('id,execution_success,outcome_linked').eq('organization_id', organizationId).limit(300),
    ])

    const objectiveIds = new Set((objectives ?? []).map((item: any) => String(item.id)))
    const activeRuns = (runs ?? []).filter((run: any) => ['planning', 'awaiting_approval', 'executing'].includes(String(run.status)))
    const failedRuns = (runs ?? []).filter((run: any) => run.status === 'failed')
    const pendingApprovals = (runs ?? []).filter((run: any) => run.status === 'awaiting_approval' || run.approval_status === 'pending')
    const verifiedOutcomes = (outcomes ?? []).filter((outcome: any) => ['measured', 'attributed'].includes(String(outcome.evidence_status)))
    const successfulEvaluations = (evaluations ?? []).filter((evaluation: any) => evaluation.execution_success === true && evaluation.outcome_linked === true)

    const state = {
      objectiveCount: objectiveIds.size,
      activeOrchestrationRuns: activeRuns.length,
      failedOrchestrationRuns: failedRuns.length,
      pendingApprovals: pendingApprovals.length,
      verifiedOutcomes: verifiedOutcomes.length,
      activeAgents: (agents ?? []).length,
      activeWorkflows: (workflows ?? []).length,
      successfulVerifiedEvaluations: successfulEvaluations.length,
      executionCapacityAvailable: (agents ?? []).length > 0 && (workflows ?? []).length > 0,
      intelligenceLoop: 'objective → assessment → approval → action → outcome → learning',
    }

    const confidence = verifiedOutcomes.length > 0 ? 'high' : (runs ?? []).length > 0 || (evaluations ?? []).length > 0 ? 'medium' : 'low'
    const evidence = [
      { source: 'company_objectives', count: objectiveIds.size },
      { source: 'business_orchestration_runs', count: runs?.length ?? 0 },
      { source: 'business_outcomes', verified: verifiedOutcomes.length },
      { source: 'agent_evaluations', verifiedLearning: successfulEvaluations.length },
    ]

    const signals = [
      ...(pendingApprovals.length > 0 ? [{ type: 'governance', severity: 'high', title: 'Governed approvals require attention', reason: 'One or more controlled actions are waiting for human approval.' }] : []),
      ...(failedRuns.length > 0 ? [{ type: 'risk', severity: 'high', title: 'Failed governed work detected', reason: 'Failed orchestration runs require investigation before new execution.' }] : []),
      ...((runs ?? []).length > 0 && verifiedOutcomes.length === 0 ? [{ type: 'evidence_gap', severity: 'medium', title: 'Evidence gap detected', reason: 'Work exists without measured or attributed outcome evidence.' }] : []),
      ...(successfulEvaluations.length > 0 ? [{ type: 'opportunity', severity: 'medium', title: 'Verified learning signal available', reason: 'Successful agent evaluations linked to outcomes can inform future prioritization.' }] : []),
      ...((agents ?? []).length > 0 && (workflows ?? []).length === 0 ? [{ type: 'capacity', severity: 'medium', title: 'Workflow capacity gap', reason: 'AI workers are available but no active workflow execution path is currently available.' }] : []),
    ]

    const signalConfidence = signals.some((signal) => signal.severity === 'high') ? 'high' : signals.length > 0 ? 'medium' : 'low'

    const forecasts = (objectives ?? []).map((objective: any) => {
      const target = objective.target_value
      const current = objective.current_value
      if (typeof target !== 'number' || typeof current !== 'number' || target === 0) return null
      const progress = Math.max(0, Math.min(100, (current / target) * 100))
      const remaining = target - current
      const relatedRuns = (runs ?? []).filter((run: any) => run.objective_id === objective.id)
      const recentCompletion = relatedRuns.some((run: any) => run.status === 'completed')
      const direction = remaining > 0 ? 'below_target' : 'at_or_above_target'
      return {
        objectiveId: String(objective.id),
        progressPercent: Math.round(progress * 10) / 10,
        remaining,
        direction,
        trajectory: recentCompletion ? 'evidence_of_progress' : 'insufficient_evidence',
        confidence: recentCompletion ? 'medium' : 'low',
      }
    }).filter(Boolean)

    const forecastConfidence = forecasts.some((item: any) => item.confidence === 'medium') ? 'medium' : 'low'

    const objectiveIntelligence = (objectives ?? []).map((objective: any) => {
      const relatedRuns = (runs ?? []).filter((run: any) => run.objective_id === objective.id)
      const completed = relatedRuns.filter((run: any) => run.status === 'completed').length
      const failed = relatedRuns.filter((run: any) => run.status === 'failed').length
      const pending = relatedRuns.filter((run: any) => run.status === 'awaiting_approval' || run.approval_status === 'pending').length
      const linkedForecast = forecasts.find((forecast: any) => forecast.objectiveId === String(objective.id))
      const pressure = failed > 0 ? 'risk' : pending > 0 ? 'governance' : linkedForecast?.direction === 'below_target' ? 'performance' : 'stable'
      return {
        objectiveId: String(objective.id),
        pressure,
        completedRuns: completed,
        failedRuns: failed,
        pendingApprovals: pending,
        forecast: linkedForecast ?? null,
      }
    })

    // Adaptive Intelligence Core: transform observed company state into
    // evidence-bounded hypotheses, scenarios, decisions, and learning signals.
    const observations = [
      { type: 'objective_state', count: objectiveIds.size, evidence: 'observed' },
      { type: 'active_work', count: activeRuns.length, evidence: 'observed' },
      { type: 'verified_outcomes', count: verifiedOutcomes.length, evidence: 'measured_or_attributed' },
      { type: 'failed_work', count: failedRuns.length, evidence: 'observed' },
      { type: 'pending_governance', count: pendingApprovals.length, evidence: 'observed' },
      { type: 'agent_learning', count: successfulEvaluations.length, evidence: 'evaluated_and_outcome_linked' },
    ]

    const hypotheses = signals.map((signal: any) => ({
      id: `signal:${signal.type}:${signal.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`,
      statement: signal.reason,
      sourceSignal: signal.type,
      status: 'working_hypothesis',
      confidence: signal.severity === 'high' ? 'medium' : 'low',
      evidenceRequired: signal.type === 'evidence_gap'
        ? 'Measured or attributed outcome evidence'
        : 'Additional verified evidence before causal or ROI claims',
    }))

    const contradictions = [
      ...(verifiedOutcomes.length === 0 && successfulEvaluations.length > 0
        ? [{ type: 'learning_without_outcome', severity: 'medium', description: 'Agent evaluations exist, but no measured or attributed business outcome is available to validate impact.' }]
        : []),
      ...(activeRuns.length > 0 && pendingApprovals.length === 0 && (workflows ?? []).length === 0
        ? [{ type: 'execution_capacity', severity: 'medium', description: 'Governed work is active but no active workflow capacity is available.' }]
        : []),
      ...(failedRuns.length > 0 && verifiedOutcomes.length > 0
        ? [{ type: 'mixed_execution_evidence', severity: 'medium', description: 'The company has both verified outcomes and failed governed work; success should not be generalized across all execution paths.' }]
        : []),
    ]

    const scenarioBase = (objectives ?? []).map((objective: any) => {
      const target = typeof objective.target_value === 'number' ? objective.target_value : null
      const current = typeof objective.current_value === 'number' ? objective.current_value : null
      const progress = target && current !== null ? Math.max(0, Math.min(100, (current / target) * 100)) : null
      return { objectiveId: String(objective.id), progressPercent: progress }
    })
    const scenarios = [
      { name: 'continue', assumption: 'Current trajectory and governance constraints persist.', objectiveState: scenarioBase },
      { name: 'evidence_first', assumption: 'Prioritize measurement, verification, and learning before expanding execution.', objectiveState: scenarioBase },
      { name: 'controlled_acceleration', assumption: 'Use available governed capacity while retaining approval and evidence gates.', objectiveState: scenarioBase },
    ]

    const decisionOptions = [
      ...(pendingApprovals.length > 0 ? [{ priority: 'high', action: 'review_pending_approvals', rationale: 'Human governance is currently blocking controlled execution.' }] : []),
      ...(failedRuns.length > 0 ? [{ priority: 'high', action: 'investigate_failed_work', rationale: 'Recent execution failures require diagnosis before scaling the same path.' }] : []),
      ...(verifiedOutcomes.length === 0 && (runs ?? []).length > 0 ? [{ priority: 'high', action: 'close_evidence_gap', rationale: 'Existing work lacks measured or attributed outcome evidence.' }] : []),
      ...((agents ?? []).length > 0 && (workflows ?? []).length > 0 ? [{ priority: 'medium', action: 'prioritize_best_governed_path', rationale: 'Both agent and workflow capacity are available for controlled orchestration.' }] : []),
    ]

    const intelligenceCore = {
      version: 'adaptive-core-v1',
      stages: ['observe', 'understand', 'hypothesize', 'reason', 'simulate', 'decide', 'govern', 'measure', 'evaluate', 'learn'],
      observations,
      understanding: {
        companyStateConfidence: confidence,
        signalConfidence,
        evidenceBound: true,
        verifiedOutcomeCount: verifiedOutcomes.length,
        activeWorkCount: activeRuns.length,
      },
      hypotheses,
      contradictions,
      scenarios,
      decisions: decisionOptions,
      learning: {
        verifiedLearningSignals: successfulEvaluations.length,
        outcomeEvidenceRequired: true,
        promotionRule: 'Only measured/attributed outcomes, verified execution evidence, or explicit human feedback may become durable learning.',
      },
      governance: {
        humanOversightRequired: true,
        autonomousExternalExecution: false,
        causalClaimsAllowed: false,
        roiClaimsAllowedWithoutPilotEvidence: false,
      },
    }

    const { data: previousSnapshot } = await supabase
      .from('company_intelligence_snapshots')
      .select('id,state,intelligence,captured_at')
      .eq('organization_id', organizationId)
      .eq('snapshot_type', 'company_state')
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const governance = {
      requiresHumanOversight: signals.some((signal: any) => signal.type === 'governance' || signal.severity === 'high'),
      highSeveritySignals: signals.filter((signal: any) => signal.severity === 'high').length,
      forecastConfidence,
      evidenceBound: true,
    }

    const snapshotState = {
      ...state,
      signalCount: signals.length,
      signals,
      forecasts,
      objectiveIntelligence,
      governance,
    }

    const intelligence = {
      confidence,
      evidence: [...evidence, { source: 'derived_signals', count: signals.length }],
      signalConfidence,
      governance,
    }

    const { data: snapshot, error } = await supabase.from('company_intelligence_snapshots').insert({
      organization_id: organizationId,
      snapshot_type: 'company_state',
      state: snapshotState,
      metrics: {
        objectiveCount: objectiveIds.size,
        activeOrchestrationRuns: activeRuns.length,
        verifiedOutcomes: verifiedOutcomes.length,
        pendingApprovals: pendingApprovals.length,
      },
      intelligence,
    }).select('id,snapshot_type,state,metrics,intelligence,captured_at').single()

    if (error) throw error
    const previousState = previousSnapshot?.state && typeof previousSnapshot.state === 'object' ? previousSnapshot.state as Record<string, any> : null
    const previousForecasts = previousState && Array.isArray(previousState.forecasts) ? previousState.forecasts : []
    const forecastEvaluations = previousForecasts.map((forecast: any) => {
      const objective = (objectives ?? []).find((item: any) => String(item.id) === String(forecast.objectiveId))
      const target = objective?.target_value
      const current = objective?.current_value
      if (!objective || typeof target !== 'number' || typeof current !== 'number' || target === 0) return null
      const observedProgress = Math.max(0, Math.min(100, (current / target) * 100))
      const absoluteError = Math.abs(Number(forecast.progressPercent) - observedProgress)
      return {
        objectiveId: String(objective.id),
        predictedProgress: Number(forecast.progressPercent),
        observedProgress,
        absoluteError,
        accuracyScore: Math.max(0, Math.min(100, 100 - absoluteError)),
        predictionConfidence: forecast.confidence === 'high' ? 'high' : forecast.confidence === 'medium' ? 'medium' : 'low',
      }
    }).filter(Boolean)

    if (previousSnapshot && forecastEvaluations.length > 0) {
      await supabase.from('company_intelligence_forecast_evaluations').upsert(
        forecastEvaluations.map((evaluation: any) => ({
          organization_id: organizationId,
          snapshot_id: previousSnapshot.id,
          objective_id: evaluation.objectiveId,
          predicted_progress: evaluation.predictedProgress,
          observed_progress: evaluation.observedProgress,
          absolute_error: evaluation.absoluteError,
          accuracy_score: evaluation.accuracyScore,
          prediction_confidence: evaluation.predictionConfidence,
        })),
        { onConflict: 'snapshot_id,objective_id' },
      )
    }

    const trackedChanges = [
      'objectiveCount',
      'activeOrchestrationRuns',
      'failedOrchestrationRuns',
      'pendingApprovals',
      'verifiedOutcomes',
      'activeAgents',
      'activeWorkflows',
      'successfulVerifiedEvaluations',
    ].filter((key) => previousState && previousState[key] !== (state as Record<string, any>)[key])

    if (previousState && trackedChanges.length > 0) {
      await supabase.from('company_intelligence_events').insert({
        organization_id: organizationId,
        snapshot_id: snapshot.id,
        event_type: 'state_change',
        severity: governance.highSeveritySignals > 0 ? 'high' : 'info',
        title: 'Company intelligence state changed',
        description: `Meaningful company state changed in: ${trackedChanges.join(', ')}.`,
        before_state: Object.fromEntries(trackedChanges.map((key) => [key, previousState[key]])),
        after_state: Object.fromEntries(trackedChanges.map((key) => [key, (state as Record<string, any>)[key]])),
        evidence: evidence,
      })
    }

    if (previousState && previousState.pendingApprovals !== state.pendingApprovals) {
      await supabase.from('company_intelligence_events').insert({
        organization_id: organizationId,
        snapshot_id: snapshot.id,
        event_type: 'governance_change',
        severity: state.pendingApprovals > 0 ? 'high' : 'info',
        title: state.pendingApprovals > 0 ? 'Governance attention increased' : 'Governance queue cleared',
        description: `Pending governed approvals changed from ${previousState.pendingApprovals ?? 0} to ${state.pendingApprovals}.`,
        before_state: { pendingApprovals: previousState.pendingApprovals ?? 0 },
        after_state: { pendingApprovals: state.pendingApprovals },
        evidence: [{ source: 'business_orchestration_runs', count: runs?.length ?? 0 }],
      })
    }

    const edgeRows = [
      ...(objectives ?? []).map((objective: any) => (runs ?? [])
        .filter((run: any) => run.objective_id === objective.id)
        .map((run: any) => ({
          organization_id: organizationId,
          from_type: 'objective',
          from_id: String(objective.id),
          to_type: 'orchestration_run',
          to_id: String(run.id),
          relation: 'acts_on',
          confidence: 'high',
          evidence: [{ source: 'company_objectives' }, { source: 'business_orchestration_runs' }],
        }))),
      ...(forecasts ?? []).map((forecast: any) => ({
        organization_id: organizationId,
        from_type: 'objective',
        from_id: String(forecast.objectiveId),
        to_type: 'forecast',
        to_id: `objective:${String(forecast.objectiveId)}`,
        relation: 'predicts',
        confidence: forecast.confidence,
        evidence: [{ source: 'company_objectives' }, { source: 'business_orchestration_runs' }],
      })),
    ].flat()

    if (edgeRows.length > 0) {
      await supabase.from('company_intelligence_edges').upsert(edgeRows, {
        onConflict: 'organization_id,from_type,from_id,to_type,to_id,relation',
      })
    }

    return NextResponse.json({
      ok: true,
      snapshot: snapshot
        ? {
            ...snapshot,
            confidence: snapshot.intelligence?.confidence ?? confidence,
            evidence: snapshot.intelligence?.evidence ?? [],
            computed_at: snapshot.captured_at,
          }
        : snapshot,
      previousSnapshotId: previousSnapshot?.id ?? null,
      signals,
      signalConfidence,
      forecasts,
      forecastConfidence,
      objectiveIntelligence,
      governance,
      longitudinal: {
        changed: trackedChanges.length > 0,
        changedFields: trackedChanges,
        recentStateAvailable: Boolean(previousSnapshot),
      },
      intelligenceCore,
      graph: {
        activeEdges: edgeRows.length,
        objectiveRelationships: edgeRows.filter((edge: any) => edge.from_type === 'objective').length,
      },
      forecastEvaluation: {
        evaluated: forecastEvaluations.length,
        averageAccuracy: forecastEvaluations.length
          ? Math.round(forecastEvaluations.reduce((sum: number, item: any) => sum + item.accuracyScore, 0) / forecastEvaluations.length)
          : null,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to compute company intelligence.' }, { status: 500 })
  }
}
