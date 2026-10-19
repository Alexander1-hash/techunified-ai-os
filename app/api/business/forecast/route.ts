import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

type KpiRow = {
  id: string
  name: string
  value: number | string | null
  previous_value: number | string | null
  unit: string | null
  period: string | null
  trend: string | null
  status: string | null
  source: string | null
  recorded_at: string | null
  updated_at: string | null
}

type TrendFit = {
  slope: number
  intercept: number
  rSquared: number | null
  rmse: number | null
  nextValue: number
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Least-squares linear trend over chronologically ordered observations.
 * This is a transparent baseline, not a causal model or a guarantee of future results.
 */
function fitLinearTrend(values: number[]): TrendFit | null {
  if (values.length < 2 || values.some((value) => !Number.isFinite(value))) {
    return null
  }

  const xs = values.map((_, index) => index)
  const n = values.length
  const meanX = xs.reduce((sum, value) => sum + value, 0) / n
  const meanY = values.reduce((sum, value) => sum + value, 0) / n
  const denominator = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0)
  if (denominator === 0) return null

  const slope =
    xs.reduce((sum, x, index) => sum + (x - meanX) * (values[index] - meanY), 0) /
    denominator
  const intercept = meanY - slope * meanX
  const predicted = xs.map((x) => intercept + slope * x)
  const residualSumSquares = values.reduce(
    (sum, value, index) => sum + (value - predicted[index]) ** 2,
    0,
  )
  const totalSumSquares = values.reduce((sum, value) => sum + (value - meanY) ** 2, 0)
  const rSquared =
    totalSumSquares === 0
      ? (residualSumSquares === 0 ? 1 : 0)
      : Math.max(0, Math.min(1, 1 - residualSumSquares / totalSumSquares))
  const rmse = Math.sqrt(residualSumSquares / n)
  const nextValue = intercept + slope * n

  if (![slope, intercept, rSquared, rmse, nextValue].every(Number.isFinite)) {
    return null
  }

  return { slope, intercept, rSquared, rmse, nextValue }
}

function round(value: number, places = 2) {
  const scale = 10 ** places
  return Math.round((value + Number.EPSILON) * scale) / scale
}

export async function GET() {
  const supabase = await createClient()
  const { profile } = await getCurrentProfile(supabase)
  const organizationId = profile?.organization_id

  if (!organizationId) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    )
  }

  const [kpiResult, relationshipsResult, intelligenceResult] = await Promise.all([
    supabase
      .from('business_kpis')
      .select(
        'id,name,value,previous_value,unit,period,trend,status,source,recorded_at,updated_at',
      )
      .eq('organization_id', organizationId)
      .order('recorded_at', { ascending: false }),
    supabase
      .from('business_relationships')
      .select('source_type,source_id,target_type,target_id,evidence_status')
      .eq('organization_id', organizationId),
    supabase
      .from('company_intelligence_snapshots')
      .select('state,intelligence,captured_at')
      .eq('organization_id', organizationId)
      .eq('snapshot_type', 'company_state')
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (kpiResult.error || relationshipsResult.error || intelligenceResult.error) {
    return NextResponse.json(
      { error: 'Unable to load forecast data.' },
      { status: 500 },
    )
  }

  const intelligenceSnapshot = intelligenceResult.data ?? null
  const intelligenceCore =
    intelligenceSnapshot?.state &&
    typeof intelligenceSnapshot.state === 'object' &&
    intelligenceSnapshot.state.intelligenceCore &&
    typeof intelligenceSnapshot.state.intelligenceCore === 'object'
      ? intelligenceSnapshot.state.intelligenceCore
      : intelligenceSnapshot?.intelligence &&
          typeof intelligenceSnapshot.intelligence === 'object' &&
          intelligenceSnapshot.intelligence.intelligenceCore &&
          typeof intelligenceSnapshot.intelligence.intelligenceCore === 'object'
        ? intelligenceSnapshot.intelligence.intelligenceCore
        : null

  const rows = (kpiResult.data ?? []) as KpiRow[]
  const relationshipRows = relationshipsResult.data ?? []
  const verifiedRelationships = relationshipRows.filter(
    (row) => row.evidence_status === 'verified',
  ).length
  const relationshipCoverage = relationshipRows.length
    ? Math.round((verifiedRelationships / relationshipRows.length) * 100)
    : 0
  const evidenceGaps = relationshipRows.filter(
    (row) => row.evidence_status !== 'verified',
  ).length

  // Keep every valid KPI observation. A missing/zero previous_value must not
  // discard a valid current observation from the statistical series.
  const grouped = new Map<string, KpiRow[]>()
  for (const row of rows) {
    if (finiteNumber(row.value) === null) continue
    const history = grouped.get(row.name) ?? []
    history.push(row)
    grouped.set(row.name, history)
  }

  const forecasts = [...grouped.entries()].map(([name, newestFirst]) => {
    const history = [...newestFirst].sort((a, b) => {
      const aTime = a.recorded_at ? Date.parse(a.recorded_at) : 0
      const bTime = b.recorded_at ? Date.parse(b.recorded_at) : 0
      return aTime - bTime
    })
    const latest = newestFirst[0]
    const current = finiteNumber(latest.value) ?? 0
    const previousObservation =
      history.length >= 2 ? finiteNumber(history[history.length - 2].value) : null
    const previous = previousObservation ?? finiteNumber(latest.previous_value)
    const values = history
      .map((row) => finiteNumber(row.value))
      .filter((value): value is number => value !== null)
    const fit = fitLinearTrend(values)

    // With only one recorded KPI row, preserve the legacy pairwise estimate but
    // explicitly mark it as weak evidence rather than calling it a statistical forecast.
    const pairwiseChange =
      previous !== null && previous !== 0 ? (current - previous) / Math.abs(previous) : null
    const projected =
      fit?.nextValue ??
      (pairwiseChange !== null ? current * (1 + pairwiseChange) : null)
    const change =
      previous !== null && previous !== 0 ? (current - previous) / Math.abs(previous) : null
    const confidence =
      fit && values.length >= 6 && fit.rSquared >= 0.7
        ? 'moderate'
        : 'limited'
    const method = fit ? 'least_squares_linear_trend' : 'pairwise_extrapolation'
    const validProjected = projected !== null && Number.isFinite(projected) ? projected : null

    return {
      name,
      unit: latest.unit,
      source: latest.source,
      period: latest.period,
      current,
      previous,
      changePercent: change === null ? null : round(change * 100, 1),
      projected: validProjected === null ? null : round(validProjected),
      direction:
        fit && Math.abs(fit.slope) > 0
          ? fit.slope > 0 ? 'up' : 'down'
          : change !== null
            ? change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
            : 'unknown',
      confidence,
      evidencePeriods: values.length,
      statisticalEvidence: {
        method,
        slopePerPeriod: fit ? round(fit.slope, 4) : null,
        rSquared: fit?.rSquared === null || fit?.rSquared === undefined ? null : round(fit.rSquared, 4),
        rootMeanSquaredError: fit?.rmse === null || fit?.rmse === undefined ? null : round(fit.rmse),
        uncertaintyBand: fit?.rmse === null || fit?.rmse === undefined ? null : {
          lower: round(fit.nextValue - fit.rmse),
          upper: round(fit.nextValue + fit.rmse),
          meaning: 'Descriptive one-RMSE band around the trend estimate; not a calibrated prediction interval.',
        },
      },
      caveat:
        values.length < 3
          ? 'Very little history is available. Treat this as a directional estimate, not a reliable prediction.'
          : 'Linear trend is a baseline only. Validate data quality, seasonality, and business context before acting.',
    }
  })

  const recommendations = forecasts
    .filter((item) => item.direction === 'up' || item.direction === 'down')
    .map((item) => ({
      title:
        item.direction === 'down'
          ? `${item.name} needs attention`
          : `${item.name} is trending upward`,
      message:
        item.direction === 'down'
          ? `${item.name} shows a downward direction in the available records. Review the source and business context before making operational changes.`
          : `${item.name} shows an upward direction in the available records. Confirm the source and investigate what is driving the movement.`,
      action: item.direction === 'down' ? 'Review source data' : 'Inspect growth drivers',
    }))

  return NextResponse.json({
    forecasts,
    recommendations,
    hasEnoughData: forecasts.some((item) => item.projected !== null),
    message:
      forecasts.length > 0
        ? 'Forecast estimates use organization-scoped KPI observations. Statistical fit and evidence limitations are returned per KPI.'
        : 'More KPI observations are required before TechUnifedAIOS can produce a forecast.',
    intelligenceCore: intelligenceCore ?? { available: false },
    relationshipEvidence: {
      explicitRelationships: relationshipRows.length,
      verifiedRelationships,
      coveragePercent: relationshipCoverage,
      nonVerifiedRelationships: evidenceGaps,
      methodology:
        'Relationship evidence is contextual forecast quality information. It does not change KPI projections or imply causation, profitability, or ROI.',
    },
    mathematicalIntelligence: {
      version: 1,
      methods: ['least_squares_linear_trend', 'root_mean_squared_error', 'r_squared_diagnostic'],
      limitations: [
        'No causal inference or seasonality adjustment is performed.',
        'The uncertainty band is descriptive, not a calibrated prediction interval.',
        'Confidence remains limited unless there are at least six observations and the linear fit has R-squared of at least 0.7.',
      ],
    },
  })
}
