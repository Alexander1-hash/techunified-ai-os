import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

type OutcomeRow = {
  id: string
  title: string
  outcome_type: string
  baseline_value: number | null
  current_value: number | null
  unit: string | null
  hours_saved: number
  cost_avoided: number
  revenue_impact: number
  implementation_cost: number
  currency: string
  evidence_status: 'measured' | 'estimated' | 'attributed'
  source: string | null
  period_start: string | null
  period_end: string | null
  action_run_id?: string | null
}

const VERIFIED_STATUSES = new Set(['measured', 'attributed'])

function num(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { profile } = await getCurrentProfile(supabase)
    const organizationId = profile?.organization_id

    if (!organizationId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('business_outcomes')
      .select(
        'id,title,outcome_type,baseline_value,current_value,unit,hours_saved,cost_avoided,revenue_impact,implementation_cost,currency,evidence_status,source,period_start,period_end,action_run_id',
      )
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (error) throw error

    const outcomes = (data ?? []) as OutcomeRow[]
    const verified = outcomes.filter((item) => VERIFIED_STATUSES.has(item.evidence_status))
    const estimated = outcomes.filter((item) => item.evidence_status === 'estimated')
    const measured = outcomes.filter((item) => item.evidence_status === 'measured')
    const attributed = outcomes.filter((item) => item.evidence_status === 'attributed')
    const unknownEvidenceStatus = outcomes.filter(
      (item) => !VERIFIED_STATUSES.has(item.evidence_status) && item.evidence_status !== 'estimated',
    )
    const withSource = outcomes.filter((item) => Boolean(item.source?.trim()))
    const withCompletePeriod = outcomes.filter((item) => Boolean(item.period_start && item.period_end))
    const linkedToActionRun = outcomes.filter((item) => Boolean(item.action_run_id))
    const traceable = outcomes.filter(
      (item) => Boolean(item.source?.trim() && item.period_start && item.period_end),
    )
    const percentage = (count: number, total: number) =>
      total > 0 ? Math.round((count / total) * 100) : null

    const learningLoop = {
      totalOutcomes: outcomes.length,
      evidence: {
        measured: measured.length,
        attributed: attributed.length,
        estimated: estimated.length,
        unknownStatus: unknownEvidenceStatus.length,
      },
      traceability: {
        withSource: withSource.length,
        missingSource: outcomes.length - withSource.length,
        withCompletePeriod: withCompletePeriod.length,
        missingPeriod: outcomes.length - withCompletePeriod.length,
        linkedToActionRun: linkedToActionRun.length,
        withoutActionRunLink: outcomes.length - linkedToActionRun.length,
        withSourceAndPeriod: traceable.length,
        sourceAndPeriodCoveragePercent: percentage(traceable.length, outcomes.length),
      },
      followUp: [
        ...(outcomes.length === 0 ? ['Record an outcome after a real business action before evaluating impact.'] : []),
        ...(outcomes.some((item) => !item.source?.trim()) ? ['Add a source or reference for outcomes that currently have no source.'] : []),
        ...(outcomes.some((item) => !item.period_start || !item.period_end) ? ['Complete the measurement period so results can be compared consistently.'] : []),
        ...(outcomes.some((item) => !item.action_run_id) ? ['Link outcomes to their action run where a valid action-run record exists.'] : []),
        ...(unknownEvidenceStatus.length > 0 ? ['Review outcomes with an unrecognized evidence status before including them in verified totals.'] : []),
      ],
      guardrails: {
        missingValuesAreNotTreatedAsMeasuredImpact: true,
        estimatesExcludedFromVerifiedTotals: true,
        actionRunLinksAreReportedAsRecordedNotIndependentlyValidated: true,
      },
    }

    const aggregate = (rows: OutcomeRow[]) => {
      const currencies = [...new Set(rows.map((row) => row.currency || 'NGN'))]
      const singleCurrency = currencies.length === 1 ? currencies[0] : null
      const costAvoided = rows.reduce((sum, row) => sum + num(row.cost_avoided), 0)
      const revenueImpact = rows.reduce((sum, row) => sum + num(row.revenue_impact), 0)
      const implementationCost = rows.reduce((sum, row) => sum + num(row.implementation_cost), 0)
      const hoursSaved = rows.reduce((sum, row) => sum + num(row.hours_saved), 0)
      const netImpact = singleCurrency ? costAvoided + revenueImpact - implementationCost : null
      const roi =
        singleCurrency && implementationCost > 0
          ? netImpact! / implementationCost
          : null

      return {
        count: rows.length,
        currencies,
        currency: singleCurrency,
        costAvoided,
        revenueImpact,
        implementationCost,
        hoursSaved,
        netImpact,
        roi,
      }
    }

    return NextResponse.json({
      ok: true,
      evidence: {
        verified: aggregate(verified),
        estimated: aggregate(estimated),
      },
      guardrails: {
        verifiedStatuses: ['measured', 'attributed'],
        estimatedExcludedFromVerifiedTotals: true,
        mixedCurrenciesExcludedFromNetAndRoi: true,
      },
      learningLoop,
      outcomes,
    })
  } catch (error) {
    console.error('[Business Outcomes] Summary failed:', error)
    return NextResponse.json({ error: 'Unable to calculate business outcome evidence.' }, { status: 500 })
  }
}
