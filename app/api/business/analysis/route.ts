import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

const METRICS = [
  'Revenue',
  'Sales',
  'Orders',
  'Customers',
  'Leads',
  'Expenses',
  'Profit',
  'Conversion Rate',
  'Churn',
  'Retention',
  'Inventory',
  'Transactions',
]

const units: Record<string, string> = {
  Revenue: 'currency',
  Sales: 'currency',
  Expenses: 'currency',
  Profit: 'currency',
  'Conversion Rate': 'percent',
  Churn: 'percent',
  Retention: 'percent',
}

const VERIFIED_OUTCOME_STATUSES = new Set(['measured', 'attributed'])
const MAX_SOURCE_RECORDS = 5000
const MAX_KPI_MAPPINGS = 50

function outcomeNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function summarizeOutcomes(rows: any[]) {
  const summarize = (items: any[]) => {
    const currencies = [...new Set(items.map((row) => row.currency || 'NGN'))]
    const currency = currencies.length === 1 ? currencies[0] : null
    const costAvoided = items.reduce((sum, row) => sum + outcomeNumber(row.cost_avoided), 0)
    const revenueImpact = items.reduce((sum, row) => sum + outcomeNumber(row.revenue_impact), 0)
    const implementationCost = items.reduce((sum, row) => sum + outcomeNumber(row.implementation_cost), 0)
    const hoursSaved = items.reduce((sum, row) => sum + outcomeNumber(row.hours_saved), 0)
    const netImpact = currency ? costAvoided + revenueImpact - implementationCost : null
    const roi = currency && implementationCost > 0 ? netImpact! / implementationCost : null
    return { count: items.length, currencies, currency, costAvoided, revenueImpact, implementationCost, hoursSaved, netImpact, roi }
  }
  const verified = rows.filter((row) => VERIFIED_OUTCOME_STATUSES.has(row.evidence_status))
  const estimated = rows.filter((row) => row.evidence_status === 'estimated')
  return { verified: summarize(verified), estimated: summarize(estimated) }
}

async function context() {
  const supabase = await createClient()
  const { profile } = await getCurrentProfile(supabase)

  return {
    supabase,
    organizationId: profile?.organization_id,
  }
}

export async function GET() {
  const { supabase, organizationId } = await context()

  if (!organizationId) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    )
  }

  const [kpis, mappings, sources, outcomes, relationshipInsights] = await Promise.all([
    supabase
      .from('business_kpis')
      .select(
        'id,name,value,previous_value,unit,period,trend,status,source,recorded_at,updated_at',
      )
      .eq('organization_id', organizationId)
      .order('recorded_at', { ascending: false }),

    supabase
      .from('business_kpi_mappings')
      .select(
        'id,source_id,field_name,metric_name,unit,confirmed_at',
      )
      .eq('organization_id', organizationId),

    supabase
      .from('business_data_sources')
      .select(
        'id,name,provider,status,configuration_metadata,last_synced_at',
      )
      .eq('organization_id', organizationId),

    supabase
      .from('business_outcomes')
      .select('id,title,outcome_type,hours_saved,cost_avoided,revenue_impact,implementation_cost,currency,evidence_status,source,period_start,period_end,action_run_id,created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false }),

    supabase
      .from('business_relationships')
      .select('source_type,source_id,relationship_type,target_type,target_id,evidence_status,confidence')
      .eq('organization_id', organizationId),
  ])

  if (kpis.error || mappings.error || sources.error || outcomes.error || relationshipInsights.error) {
    return NextResponse.json(
      { error: 'Unable to load analyst data.' },
      { status: 500 },
    )
  }

  const rows = kpis.data ?? []
  const relationshipRows = relationshipInsights.data ?? []

  const relationshipCoverage = {
    explicit: relationshipRows.length,
    verified: relationshipRows.filter((row: any) => row.evidence_status === 'verified').length,
    estimated: relationshipRows.filter((row: any) => row.evidence_status === 'estimated').length,
    inferred: relationshipRows.filter((row: any) => row.evidence_status === 'inferred').length,
  }

  const areas = new Set(
    rows.map((k: any) => {
      if (
        k.name === 'Revenue' ||
        k.name === 'Paid Revenue'
      ) {
        return 'Finance'
      }

      if (
        k.name === 'Sales' ||
        k.name === 'Leads'
      ) {
        return 'Sales'
      }

      if (
        k.name === 'Customers' ||
        k.name === 'Active Customers'
      ) {
        return 'Customers'
      }

      return k.name
    }),
  )

  const quality = rows.length
    ? Math.round(
        (rows.filter(
          (k: any) => k.status !== 'warning',
        ).length /
          rows.length) *
          100,
      )
    : 0

  const health =
    rows.length >= 2
      ? Math.round(
          rows.reduce(
            (sum: number, k: any) =>
              sum +
              (k.trend === 'down'
                ? 40
                : k.trend === 'up'
                  ? 90
                  : 70),
            0,
          ) / rows.length,
        )
      : null

  const recommendations = rows
    .filter(
      (k: any) =>
        k.previous_value !== null &&
        k.previous_value !== undefined &&
        k.value !== null &&
        k.value < k.previous_value,
    )
    .map((k: any) => ({
      title: `${k.name} declined`,
      problem: `${k.name} fell from ${k.previous_value} to ${k.value}.`,
      recommended_action: `Review the ${
        k.source ?? 'connected'
      } data behind ${k.name}.`,
      category: k.name,
      confidence: quality / 100,
      evidence: {
        kpi: k.name,
        current: k.value,
        previous: k.previous_value,
      },
    }))

  const hasOperationalIntelligence = rows.some(
    (k: any) =>
      k.source === 'Sales Intelligence',
  )

  const hasConnectedSource =
    Boolean(sources.data?.length) &&
    Boolean(mappings.data?.length)

  let nextAction =
    'Review the latest evidence across your business areas.'

  if (
    !hasOperationalIntelligence &&
    !sources.data?.length
  ) {
    nextAction =
      'Connect a verified data source to expand business intelligence.'
  } else if (
    hasConnectedSource &&
    rows.length < 2
  ) {
    nextAction =
      'Import additional historical data to strengthen analysis.'
  } else if (quality < 80) {
    nextAction =
      'Resolve data-quality warnings before acting on the affected KPIs.'
  } else if (recommendations.length) {
    nextAction =
      recommendations[0].recommended_action
  }

  return NextResponse.json({
    kpis: rows,
    mappings: mappings.data ?? [],
    sources: sources.data ?? [],
    outcomes: summarizeOutcomes(outcomes.data ?? []),
    relationshipIntelligence: {
      coverage: relationshipCoverage,
      relationships: relationshipRows,
      source: '/api/business/relationships/insights',
      methodology: 'Relationship intelligence is included as evidence for Business Analyst review. Unsupported profitability, cost, ROI, or funnel claims remain unavailable until verified evidence exists.',
    },
    health,
    areas: [...areas],
    quality,
    recommendations,
    nextAction,
  })
}

export async function POST(request: Request) {
  const { supabase, organizationId } = await context()

  if (!organizationId) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    )
  }

  const body = await request.json().catch(() => null)

  if (
    !body?.sourceId ||
    !Array.isArray(body.mappings)
  ) {
    return NextResponse.json(
      { error: 'Source and mappings are required.' },
      { status: 400 },
    )
  }

  const { data: source } = await supabase
    .from('business_data_sources')
    .select(
      'id,name,configuration_metadata',
    )
    .eq('id', body.sourceId)
    .eq('organization_id', organizationId)
    .single()

  if (!source) {
    return NextResponse.json(
      { error: 'Source not found.' },
      { status: 404 },
    )
  }

  const {
    data: records,
    error: recordsError,
  } = await supabase
    .from('business_source_records')
    .select('id,payload,recorded_at')
    .eq('source_id', source.id)
    .eq('organization_id', organizationId)
    .order('recorded_at', { ascending: true })
    .limit(MAX_SOURCE_RECORDS + 1)

  if (recordsError) {
    return NextResponse.json(
      { error: 'Source records are unavailable. Apply the Brain pipeline migration.' },
      { status: 500 },
    )
  }

  if ((records ?? []).length > MAX_SOURCE_RECORDS) {
    return NextResponse.json(
      { error: `This source has more than ${MAX_SOURCE_RECORDS} records. Narrow the import before calculating KPIs so totals are not silently incomplete.` },
      { status: 413 },
    )
  }

  if (!records?.length) {
    return NextResponse.json(
      { error: 'This source has no imported records to analyze.' },
      { status: 422 },
    )
  }

  if (body.mappings.length > MAX_KPI_MAPPINGS) {
    return NextResponse.json(
      { error: `Submit no more than ${MAX_KPI_MAPPINGS} KPI mappings at a time.` },
      { status: 413 },
    )
  }

  const sample = records.map((record: { payload: Record<string, unknown> | null }) =>
    record.payload && typeof record.payload === 'object' ? record.payload : {},
  )

  type ValidMapping = { fieldName: string; metricName: string; unit?: string }

  const valid: ValidMapping[] = (body.mappings as unknown[]).map((m: unknown): ValidMapping => {
    if (!m || typeof m !== 'object') return { fieldName: '', metricName: '', unit: undefined }
    const item = m as Record<string, unknown>
    return {
      fieldName: typeof item.fieldName === 'string'
        ? item.fieldName.trim()
        : typeof item.column === 'string' ? item.column.trim() : '',
      metricName: typeof item.metricName === 'string'
        ? item.metricName.trim()
        : typeof item.metric === 'string' ? item.metric.trim() : '',
      unit: typeof item.unit === 'string' ? item.unit.trim() : undefined,
    }
  })

  if (!valid.length || valid.some((m) => !m.fieldName || !METRICS.includes(m.metricName))) {
    return NextResponse.json(
      { error: 'Each mapping must include a field and a supported KPI metric.' },
      { status: 422 },
    )
  }

  if (
    new Set(valid.map((m) => m.fieldName)).size !== valid.length ||
    new Set(valid.map((m) => m.metricName)).size !== valid.length
  ) {
    return NextResponse.json(
      { error: 'Map each source field and KPI metric only once per request.' },
      { status: 422 },
    )
  }

  const availableFields = new Set(sample.flatMap((row) => Object.keys(row)))
  const prepared: Array<ValidMapping & { total: number | null }> = valid.map((mapping) => {
    if (!availableFields.has(mapping.fieldName)) {
      return { ...mapping, total: null as number | null }
    }

    const values = sample
      .map((row) => row[mapping.fieldName])
      .filter((value): value is string | number =>
        (typeof value === 'number' && Number.isFinite(value)) ||
        (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value.trim()))),
      )
      .map((value) => Number(value))

    return {
      ...mapping,
      total: values.length ? values.reduce((sum, value) => sum + value, 0) : null,
    }
  })

  const missingFields = prepared.filter((mapping) => !availableFields.has(mapping.fieldName))
  if (missingFields.length) {
    return NextResponse.json(
      { error: `Source field not found: ${missingFields.map((mapping) => mapping.fieldName).join(', ')}.` },
      { status: 422 },
    )
  }

  const analyzable = prepared.filter((mapping): mapping is ValidMapping & { total: number } => mapping.total !== null)
  if (!analyzable.length) {
    return NextResponse.json(
      { error: 'The selected columns contain no numeric values. Blank cells are ignored, not counted as zero.' },
      { status: 422 },
    )
  }

  const mappingRows = analyzable.map((mapping) => ({
    organization_id: organizationId,
    source_id: source.id,
    field_name: mapping.fieldName,
    metric_name: mapping.metricName,
    unit: mapping.unit || units[mapping.metricName] || 'count',
  }))

  const { error: mappingError } = await supabase
    .from('business_kpi_mappings')
    .upsert(mappingRows, { onConflict: 'source_id,field_name' })

  if (mappingError) {
    return NextResponse.json({ error: 'Could not persist KPI mappings.' }, { status: 500 })
  }

  let persistedKpis = 0
  for (const mapping of analyzable) {
    const { data: existingKpi, error: existingKpiError } = await supabase
      .from('business_kpis')
      .select('id,value,previous_value')
      .eq('organization_id', organizationId)
      .eq('name', mapping.metricName)
      .maybeSingle()

    if (existingKpiError) {
      return NextResponse.json({ error: 'Could not load the existing KPI value.' }, { status: 500 })
    }

    const now = new Date().toISOString()
    const kpiPayload = {
      organization_id: organizationId,
      name: mapping.metricName,
      value: mapping.total,
      previous_value: existingKpi?.value !== null && existingKpi?.value !== undefined
        ? existingKpi.value
        : existingKpi?.previous_value ?? null,
      unit: mapping.unit || units[mapping.metricName] || 'count',
      period: 'Imported records',
      status: 'verified',
      source: source.name,
      recorded_at: now,
      updated_at: now,
    }

    const { error: kpiError } = existingKpi?.id
      ? await supabase.from('business_kpis').update(kpiPayload).eq('id', existingKpi.id).eq('organization_id', organizationId)
      : await supabase.from('business_kpis').insert(kpiPayload)

    if (kpiError) {
      return NextResponse.json({ error: 'A KPI could not be persisted. Refresh Analyst data before retrying.' }, { status: 500 })
    }

    persistedKpis += 1
  }

  return NextResponse.json({
    ok: true,
    persistedKpis,
  })
}
