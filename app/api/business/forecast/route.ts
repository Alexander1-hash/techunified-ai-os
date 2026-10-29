import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

const MAX_KPI_RECORDS = 800
const MAX_RELATIONSHIPS = 800

export async function GET() {
  const supabase = await createClient()
  const { profile } = await getCurrentProfile(supabase)
  const organizationId = profile?.organization_id

  if (!organizationId) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 }
    )
  }

  const [kpiResult, relationshipsResult, intelligenceResult] = await Promise.all([
    supabase
      .from('business_kpis')
      .select(
        'id,name,value,previous_value,unit,period,trend,status,source,recorded_at,updated_at'
      )
      .eq('organization_id', organizationId)
      .order('recorded_at', { ascending: false })
      .limit(MAX_KPI_RECORDS + 1),
    supabase
      .from('business_relationships')
      .select('source_type,source_id,target_type,target_id,evidence_status')
      .eq('organization_id', organizationId)
      .limit(MAX_RELATIONSHIPS + 1),
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
      { status: 500 }
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

  const retrievedKpis = kpiResult.data ?? []
  const retrievedRelationships = relationshipsResult.data ?? []
  const kpiWindowTruncated = retrievedKpis.length > MAX_KPI_RECORDS
  const relationshipWindowTruncated = retrievedRelationships.length > MAX_RELATIONSHIPS
  const rows = retrievedKpis.slice(0, MAX_KPI_RECORDS)
  const relationshipRows = retrievedRelationships.slice(0, MAX_RELATIONSHIPS)
  const verifiedRelationships = relationshipRows.filter(
    (row) => row.evidence_status === 'verified',
  ).length
  const relationshipCoverage = relationshipRows.length
    ? Math.round((verifiedRelationships / relationshipRows.length) * 100)
    : 0
  const evidenceGaps = relationshipRows.filter(
    (row) => row.evidence_status !== 'verified',
  ).length

  const grouped = new Map<string, any[]>()

  for (const row of rows ?? []) {
    const current = Number(row.value)
    const previous = Number(row.previous_value)

    if (
      !Number.isFinite(current) ||
      !Number.isFinite(previous) ||
      previous === 0
    ) {
      continue
    }

    const history = grouped.get(row.name) ?? []
    history.push(row)
    grouped.set(row.name, history)
  }

  const forecasts = [...grouped.entries()].map(([name, history]) => {
    const latest = history[0]
    const current = Number(latest.value)
    const previous = Number(latest.previous_value)

    const change = (current - previous) / Math.abs(previous)
    const projected = current * (1 + change)

    const confidence =
      kpiWindowTruncated
        ? 'limited'
        : history.length >= 3
          ? 'higher'
          : history.length >= 2
            ? 'moderate'
            : 'limited'

    return {
      name,
      unit: latest.unit,
      source: latest.source,
      period: latest.period,
      current,
      previous,
      changePercent: Math.round(change * 1000) / 10,
      projected: Math.round(projected * 100) / 100,
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
      confidence,
      evidencePeriods: history.length,
    }
  })

  const recommendations = forecasts
    .filter((item) => item.direction !== 'flat')
    .map((item) => ({
      title:
        item.direction === 'down'
          ? `${item.name} needs attention`
          : `${item.name} is trending upward`,
      message:
        item.direction === 'down'
          ? `${item.name} is currently ${Math.abs(item.changePercent)}% below the previous recorded value. Review the connected source before making operational changes.`
          : `${item.name} is currently ${item.changePercent}% above the previous recorded value. Confirm the underlying source and consider what is driving the improvement.`,
      action:
        item.direction === 'down'
          ? 'Review source data'
          : 'Inspect growth drivers',
    }))

  return NextResponse.json({
    forecasts,
    recommendations,
    hasEnoughData: forecasts.length > 0,
    dataCompleteness: {
      completeWithinConfiguredWindow: !kpiWindowTruncated && !relationshipWindowTruncated,
      kpiRecordsReviewed: rows.length,
      kpiRecordLimit: MAX_KPI_RECORDS,
      kpiHistoryTruncated: kpiWindowTruncated,
      relationshipsReviewed: relationshipRows.length,
      relationshipLimit: MAX_RELATIONSHIPS,
      relationshipsTruncated: relationshipWindowTruncated,
      warning: kpiWindowTruncated || relationshipWindowTruncated
        ? 'Forecast evidence is bounded. Older KPI or relationship records may be excluded; confidence is downgraded when KPI history is truncated.'
        : null,
    },
    message:
      forecasts.length > 0
        ? kpiWindowTruncated
          ? 'Forecasts use a bounded KPI history window; older records were excluded and confidence is limited.'
          : 'Forecasts are based on available organization KPI records. Confirm source status and measurement quality before acting.'
        : 'More historical KPI data with comparable values is required before a forecast can be produced.',
    intelligenceCore: intelligenceCore ?? { available: false },
    relationshipEvidence: {
      explicitRelationships: relationshipRows.length,
      verifiedRelationships,
      coveragePercent: relationshipCoverage,
      nonVerifiedRelationships: evidenceGaps,
      methodology:
        'Relationship evidence is contextual forecast quality information. It does not change KPI projections or imply causation, profitability, or ROI.',
    },
  })
}
