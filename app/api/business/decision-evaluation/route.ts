import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

const MAX_ACTION_RUNS = 100
const MAX_OUTCOMES = 500

type ActionRun = {
  id: string
  status: string | null
  decision_id: string | null
  created_at: string | null
}

type Outcome = {
  id: string
  title: string
  outcome_type: string
  baseline_value: number | string | null
  current_value: number | string | null
  unit: string | null
  evidence_status: string | null
  source: string | null
  notes: string | null
  period_start: string | null
  period_end: string | null
  action_run_id: string | null
  hours_saved: number | string | null
  cost_avoided: number | string | null
  revenue_impact: number | string | null
  implementation_cost: number | string | null
  currency: string | null
}

type FinancialEvidence = {
  currency: string
  evidenceStatus: string
  outcomeCount: number
  recordsWithFinancialValues: number
  hoursSaved: number
  hoursSavedRecords: number
  costAvoided: number
  costAvoidedRecords: number
  revenueImpact: number
  revenueImpactRecords: number
  implementationCost: number
  implementationCostRecords: number
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function buildFinancialEvidence(outcomes: Outcome[]): FinancialEvidence[] {
  const totals = new Map<string, FinancialEvidence>()

  for (const outcome of outcomes) {
    if (!outcome.action_run_id) continue

    const currency = outcome.currency?.trim().toUpperCase() || 'Unspecified currency'
    const evidenceStatus = outcome.evidence_status || 'unknown'
    const key = currency + ':' + evidenceStatus
    const row = totals.get(key) ?? {
      currency,
      evidenceStatus,
      outcomeCount: 0,
      recordsWithFinancialValues: 0,
      hoursSaved: 0,
      hoursSavedRecords: 0,
      costAvoided: 0,
      costAvoidedRecords: 0,
      revenueImpact: 0,
      revenueImpactRecords: 0,
      implementationCost: 0,
      implementationCostRecords: 0,
    }

    const hoursSaved = finiteNumber(outcome.hours_saved)
    const costAvoided = finiteNumber(outcome.cost_avoided)
    const revenueImpact = finiteNumber(outcome.revenue_impact)
    const implementationCost = finiteNumber(outcome.implementation_cost)

    row.outcomeCount += 1
    if ([costAvoided, revenueImpact, implementationCost].some((value) => value !== null)) {
      row.recordsWithFinancialValues += 1
    }
    if (hoursSaved !== null) {
      row.hoursSaved += hoursSaved
      row.hoursSavedRecords += 1
    }
    if (costAvoided !== null) {
      row.costAvoided += costAvoided
      row.costAvoidedRecords += 1
    }
    if (revenueImpact !== null) {
      row.revenueImpact += revenueImpact
      row.revenueImpactRecords += 1
    }
    if (implementationCost !== null) {
      row.implementationCost += implementationCost
      row.implementationCostRecords += 1
    }
    totals.set(key, row)
  }

  return [...totals.values()].sort((a, b) =>
    a.currency.localeCompare(b.currency) || a.evidenceStatus.localeCompare(b.evidenceStatus),
  )
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
        .select('id,status,decision_id,created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(MAX_ACTION_RUNS + 1),
      supabase
        .from('business_outcomes')
        .select('id,title,outcome_type,baseline_value,current_value,unit,evidence_status,source,notes,period_start,period_end,action_run_id,hours_saved,cost_avoided,revenue_impact,implementation_cost,currency')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(MAX_OUTCOMES + 1),
    ])

    if (runsResult.error) throw runsResult.error
    if (outcomesResult.error) throw outcomesResult.error

    const retrievedRuns = runsResult.data ?? []
    const retrievedOutcomes = outcomesResult.data ?? []
    const actionRunWindowTruncated = retrievedRuns.length > MAX_ACTION_RUNS
    const outcomeWindowTruncated = retrievedOutcomes.length > MAX_OUTCOMES
    const runs = retrievedRuns.slice(0, MAX_ACTION_RUNS) as ActionRun[]
    const outcomes = retrievedOutcomes.slice(0, MAX_OUTCOMES) as Outcome[]
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
        createdAt: run.created_at,
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
            notes: outcome.notes,
            periodStart: outcome.period_start,
            periodEnd: outcome.period_end,
            unit: outcome.unit,
            baseline,
            current,
            change: comparable ? current - baseline : null,
            percentageChange: comparable && baseline !== 0 ? ((current - baseline) / Math.abs(baseline)) * 100 : null,
            hoursSaved: finiteNumber(outcome.hours_saved),
            costAvoided: finiteNumber(outcome.cost_avoided),
            revenueImpact: finiteNumber(outcome.revenue_impact),
            implementationCost: finiteNumber(outcome.implementation_cost),
            currency: outcome.currency,
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
    const linkedOutcomes = outcomes.filter((outcome) => Boolean(outcome.action_run_id))
    const linkedOutcomesWithFinancialValues = linkedOutcomes.filter((outcome) =>
      [outcome.cost_avoided, outcome.revenue_impact, outcome.implementation_cost]
        .some((value) => finiteNumber(value) !== null),
    )

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      limits: { actionRuns: MAX_ACTION_RUNS, outcomes: MAX_OUTCOMES },
      summary: {
        actionRunsReviewed: evaluations.length,
        completedRuns: completedRuns.length,
        completedRunsWithOutcome: linkedCompletedRuns.length,
        completedRunsAwaitingOutcome: awaitingOutcome.length,
        completedRunsWithMeasuredEvidence: withMeasuredEvidence.length,
        completedRunsWithAttributedEvidence: withAttributedEvidence.length,
        completedRunsWithComparableValues: withComparableOutcome.length,
        outcomeCoveragePercent: completedRuns.length ? Math.round((linkedCompletedRuns.length / completedRuns.length) * 100) : null,
        linkedOutcomesReviewed: linkedOutcomes.length,
        linkedOutcomesWithFinancialValues: linkedOutcomesWithFinancialValues.length,
      },
      financialEvidenceByCurrency: buildFinancialEvidence(outcomes),
      guardrails: {
        organizationScoped: true,
        onlyRecordedActionRunLinksAreUsed: true,
        financialFiguresAreGroupedByCurrencyAndEvidenceStatus: true,
        estimatedValuesAreNotRelabeledAsMeasured: true,
        numericDirectionDoesNotDetermineBenefit: true,
        correlationDoesNotProveCausation: true,
        outcomesOutsideLatest500MayNotBeIncluded: outcomeWindowTruncated,
        actionRunLimitReached: actionRunWindowTruncated,
        resultsArePartial: actionRunWindowTruncated || outcomeWindowTruncated,
        partialResultsWarning: actionRunWindowTruncated || outcomeWindowTruncated
          ? 'This evaluation uses bounded, newest-first windows. Older action runs or outcomes may be excluded; coverage and financial summaries apply only to the reviewed window.'
          : null,
      },
      evaluations,
    })
  } catch (error) {
    console.error('[Decision Evaluation] GET failed:', error)
    return NextResponse.json({ error: 'Unable to load decision evaluation evidence.' }, { status: 500 })
  }
}
