import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

type ActionRun = {
  id: string
  status: string | null
  decision_id: string | null
}

type Outcome = {
  id: string
  title: string
  outcome_type: string
  baseline_value: number | null
  current_value: number | null
  unit: string | null
  evidence_status: string | null
  source: string | null
  period_start: string | null
  period_end: string | null
  action_run_id: string | null
  cost_avoided: number | string | null
  revenue_impact: number | string | null
  implementation_cost: number | string | null
  currency: string | null
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { profile } = await getCurrentProfile(supabase)
    const organizationId = profile?.organization_id

    if (!organizationId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const [runsResult, outcomesResult] = await Promise.all([
      supabase
        .from('business_action_runs')
        .select('id,status,decision_id')
        .eq('organization_id', organizationId)
        .limit(100),
      supabase
        .from('business_outcomes')
        .select('id,title,outcome_type,baseline_value,current_value,unit,evidence_status,source,period_start,period_end,action_run_id,cost_avoided,revenue_impact,implementation_cost,currency')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(500),
    ])

    if (runsResult.error) throw runsResult.error
    if (outcomesResult.error) throw outcomesResult.error

    const runs = (runsResult.data ?? []) as ActionRun[]
    const outcomes = (outcomesResult.data ?? []) as Outcome[]
    const outcomesByRun = new Map<string, Outcome[]>()

    for (const outcome of outcomes) {
      if (!outcome.action_run_id) continue
      const existing = outcomesByRun.get(outcome.action_run_id) ?? []
      existing.push(outcome)
      outcomesByRun.set(outcome.action_run_id, existing)
    }

    const evaluations = runs.map((run) => {
      const linkedOutcomes = outcomesByRun.get(run.id) ?? []
      const evidenceStatuses = [...new Set(linkedOutcomes.map((item) => item.evidence_status ?? 'unknown'))]
      const hasMeasured = linkedOutcomes.some((item) => item.evidence_status === 'measured')
      const hasAttributed = linkedOutcomes.some((item) => item.evidence_status === 'attributed')
      const hasEstimate = linkedOutcomes.some((item) => item.evidence_status === 'estimated')
      const evidenceState = hasMeasured
        ? 'measured'
        : hasAttributed
          ? 'attributed'
          : hasEstimate
            ? 'estimated'
            : linkedOutcomes.length
              ? 'unknown'
              : 'awaiting_outcome'

      return {
        actionRunId: run.id,
        actionStatus: run.status ?? 'unknown',
        decisionId: run.decision_id,
        createdAt: null,
        outcomeCount: linkedOutcomes.length,
        evidenceState,
        evidenceStatuses,
        outcomes: linkedOutcomes.map((outcome) => {
          const baseline = finiteNumber(outcome.baseline_value)
          const current = finiteNumber(outcome.current_value)
          const comparable = baseline !== null && current !== null
          return {
            id: outcome.id,
            title: outcome.title,
            outcomeType: outcome.outcome_type,
            evidenceStatus: outcome.evidence_status ?? 'unknown',
            source: outcome.source,
            periodStart: outcome.period_start,
            periodEnd: outcome.period_end,
            unit: outcome.unit,
            baseline,
            current,
            change: comparable ? current - baseline : null,
            percentageChange: comparable && baseline !== 0 ? ((current - baseline) / Math.abs(baseline)) * 100 : null,
            directionIsDescriptiveOnly: true,
          }
        }),
      }
    })

    const completedRuns = evaluations.filter((item) => item.actionStatus === 'completed')
    const linkedCompletedRuns = completedRuns.filter((item) => item.outcomeCount > 0)
    const withMeasuredEvidence = completedRuns.filter((item) => item.evidenceState === 'measured')
    const withAttributedEvidence = completedRuns.filter((item) => item.evidenceState === 'attributed')
    const awaitingOutcome = completedRuns.filter((item) => item.outcomeCount === 0)
    const withComparableOutcome = completedRuns.filter((item) =>
      item.outcomes.some((outcome) => outcome.baseline !== null && outcome.current !== null),
    )

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      limits: { actionRuns: 100, outcomes: 500 },
      summary: {
        actionRunsReviewed: evaluations.length,
        completedRuns: completedRuns.length,
        completedRunsWithOutcome: linkedCompletedRuns.length,
        completedRunsAwaitingOutcome: awaitingOutcome.length,
        completedRunsWithMeasuredEvidence: withMeasuredEvidence.length,
        completedRunsWithAttributedEvidence: withAttributedEvidence.length,
        completedRunsWithComparableValues: withComparableOutcome.length,
        outcomeCoveragePercent: completedRuns.length ? Math.round((linkedCompletedRuns.length / completedRuns.length) * 100) : null,
      },
      guardrails: {
        organizationScoped: true,
        onlyRecordedActionRunLinksAreUsed: true,
        numericDirectionDoesNotDetermineBenefit: true,
        correlationDoesNotProveCausation: true,
        outcomesOutsideLatest500MayNotBeIncluded: outcomes.length === 500,
        actionRunLimitReached: runs.length === 100,
      },
      evaluations,
    })
  } catch (error) {
    console.error('[Decision Evaluation] GET failed:', error)
    return NextResponse.json({ error: 'Unable to load decision evaluation evidence.' }, { status: 500 })
  }
}
