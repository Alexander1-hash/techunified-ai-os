import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

type Priority = 'critical' | 'high' | 'medium'
type Decision = {
  id: string
  priority: Priority
  title: string
  recommendation: string
  rationale: string
  evidence: string[]
  confidence: 'high' | 'medium' | 'low'
  approvalRequired: boolean
  financialImpact: 'not_estimated'
}

const priorityRank: Record<Priority, number> = { critical: 0, high: 1, medium: 2 }

export async function GET() {
  try {
    const supabase = await createClient()
    const { profile } = await getCurrentProfile(supabase)
    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const organizationId = profile.organization_id
    const [
      { data: objectives, error: objectivesError },
      { data: runs, error: runsError },
      { data: outcomes, error: outcomesError },
      { data: actionRuns, error: actionRunsError },
      { data: kpis, error: kpisError },
      { data: sourceRecords, error: sourceRecordsError },
    ] = await Promise.all([
      supabase.from('company_objectives').select('id,title,status,target_value,current_value').eq('organization_id', organizationId).limit(200),
      supabase.from('business_orchestration_runs').select('id,objective_id,status,approval_status,created_at').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(300),
      supabase.from('business_outcomes').select('id,action_run_id,evidence_status,created_at').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(1000),
      supabase.from('business_action_runs').select('id,status,created_at').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(1000),
      supabase.from('business_kpis').select('id').eq('organization_id', organizationId).limit(500),
      supabase.from('business_source_records').select('id').eq('organization_id', organizationId).limit(1000),
    ])

    const queryError = objectivesError || runsError || outcomesError || actionRunsError || kpisError || sourceRecordsError
    if (queryError) {
      console.error('Decision brief data query failed', queryError)
      return NextResponse.json({ error: 'Unable to assemble a reliable decision brief from current business records.' }, { status: 500 })
    }

    const objectiveRows = objectives ?? []
    const orchestrationRows = runs ?? []
    const outcomeRows = outcomes ?? []
    const actionRows = actionRuns ?? []
    const verifiedOutcomes = outcomeRows.filter((row: any) => ['measured', 'attributed'].includes(String(row.evidence_status)))
    const verifiedActionIds = new Set(verifiedOutcomes.map((row: any) => row.action_run_id).filter(Boolean).map(String))
    const completedActions = actionRows.filter((row: any) => row.status === 'completed')
    const actionsNeedingMeasurement = completedActions.filter((row: any) => !verifiedActionIds.has(String(row.id)))
    const pendingApprovals = orchestrationRows.filter((row: any) => row.status === 'awaiting_approval' || row.approval_status === 'pending')
    const failedRuns = orchestrationRows.filter((row: any) => row.status === 'failed')
    const hasBusinessData = (kpis ?? []).length > 0 || (sourceRecords ?? []).length > 0

    const decisions: Decision[] = []

    if (failedRuns.length > 0) {
      decisions.push({
        id: 'diagnose-failed-execution',
        priority: 'critical',
        title: 'Diagnose failed business execution',
        recommendation: 'Inspect failure details and correct the underlying cause before retrying affected work.',
        rationale: 'Failure evidence should be resolved before increasing execution volume.',
        evidence: [`${failedRuns.length} failed orchestration run(s) in the latest 300 observed runs`],
        confidence: 'high',
        approvalRequired: false,
        financialImpact: 'not_estimated',
      })
    }

    if (pendingApprovals.length > 0) {
      decisions.push({
        id: 'review-governance-queue',
        priority: 'high',
        title: 'Resolve pending human approvals',
        recommendation: 'Review each pending proposal, its evidence, and its expected effects; approve or reject explicitly.',
        rationale: 'Governed actions must not bypass required human decisions.',
        evidence: [`${pendingApprovals.length} orchestration run(s) awaiting approval or marked approval-pending`],
        confidence: 'high',
        approvalRequired: true,
        financialImpact: 'not_estimated',
      })
    }

    if (actionsNeedingMeasurement.length > 0) {
      decisions.push({
        id: 'measure-completed-actions',
        priority: 'high',
        title: 'Measure completed actions before scaling them',
        recommendation: 'Link each completed action to a source-backed baseline, measurement period, and measured or attributed result.',
        rationale: 'Completion is not proof of business value; evidence is needed to compare approaches and improve future prioritization.',
        evidence: [
          `${actionsNeedingMeasurement.length} completed action run(s) lack linked measured or attributed outcomes in the observed window`,
          `${verifiedOutcomes.length} measured or attributed outcome record(s) found`,
        ],
        confidence: 'high',
        approvalRequired: false,
        financialImpact: 'not_estimated',
      })
    }

    if (!hasBusinessData) {
      decisions.push({
        id: 'ground-decisions-in-company-data',
        priority: 'high',
        title: 'Connect and validate company operating data',
        recommendation: 'Import or connect business records, validate their freshness, and map reliable metrics before making data-dependent decisions.',
        rationale: 'Without KPI or source-record evidence, company-specific recommendations have limited grounding.',
        evidence: ['No business KPI records or business source records were found for this organization'],
        confidence: 'high',
        approvalRequired: false,
        financialImpact: 'not_estimated',
      })
    }

    for (const objective of objectiveRows as any[]) {
      if (objective.target_value == null || objective.current_value == null || objective.target_value === '' || objective.current_value === '') continue
      const target = typeof objective.target_value === 'number' ? objective.target_value : Number(objective.target_value)
      const current = typeof objective.current_value === 'number' ? objective.current_value : Number(objective.current_value)
      if (!Number.isFinite(target) || !Number.isFinite(current) || target <= 0 || current >= target) continue

      const related = orchestrationRows.filter((run: any) => String(run.objective_id ?? '') === String(objective.id))
      const failed = related.filter((run: any) => run.status === 'failed').length
      const awaiting = related.filter((run: any) => run.status === 'awaiting_approval' || run.approval_status === 'pending').length
      const progress = Math.round((current / target) * 1000) / 10
      decisions.push({
        id: `objective-gap:${String(objective.id)}`,
        priority: failed > 0 ? 'high' : 'medium',
        title: `Review objective progress: ${String(objective.title ?? 'Company objective')}`,
        recommendation: failed > 0
          ? 'Investigate the linked failures and verify the objective data before choosing a corrective action.'
          : awaiting > 0
            ? 'Resolve the related approval queue, then review progress using the next fresh measurement.'
            : 'Verify the target period, source freshness, and blockers; select a corrective action only after confirming the gap.',
        rationale: 'Recorded progress is below the recorded target. This is a status signal, not evidence of why the gap exists.',
        evidence: [
          `Recorded progress: ${progress}% of target`,
          `Related orchestration runs observed: ${related.length}`,
          `Related failures: ${failed}; pending approvals: ${awaiting}`,
        ],
        confidence: hasBusinessData ? 'medium' : 'low',
        approvalRequired: false,
        financialImpact: 'not_estimated',
      })
    }

    const sorted = decisions.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])
    const observedCounts = {
      objectives: objectiveRows.length,
      orchestrationRuns: orchestrationRows.length,
      completedActionRuns: completedActions.length,
      measuredOrAttributedOutcomes: verifiedOutcomes.length,
      completedActionsNeedingMeasurement: actionsNeedingMeasurement.length,
      pendingApprovals: pendingApprovals.length,
      failedOrchestrationRuns: failedRuns.length,
      kpiRecords: (kpis ?? []).length,
      sourceRecords: (sourceRecords ?? []).length,
      recordWindowLimits: {
        objectives: 200,
        orchestrationRuns: 300,
        actionRuns: 1000,
        outcomes: 1000,
        kpis: 500,
        sourceRecords: 1000,
      },
    }

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      summary: {
        decisionCount: sorted.length,
        highestPriority: sorted[0]?.priority ?? null,
        evidenceGrounding: hasBusinessData ? 'business_data_available' : 'business_data_missing',
        executionSafety: 'recommendations_only',
      },
      decisions: sorted.slice(0, 12),
      evidence: observedCounts,
      guardrails: {
        organizationScoped: true,
        humanApprovalRequiredForGovernedExecution: true,
        autonomousExecutionPerformed: false,
        financialImpactEstimated: false,
        causalClaimsMade: false,
        verifiedOutcomeStatuses: ['measured', 'attributed'],
        note: 'Rankings are deterministic triage based on observed records, not proof of causality or predicted financial return. Review freshness and source quality before acting.',
      },
    })
  } catch (error) {
    console.error('Decision brief generation failed', error)
    return NextResponse.json({ error: 'Unable to generate the decision brief.' }, { status: 500 })
  }
}
