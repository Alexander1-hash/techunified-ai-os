import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

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

  const { data: kpis, error } = await supabase
    .from('business_kpis')
    .select(
      'id,name,value,previous_value,unit,period,trend,status,source,recorded_at,updated_at'
    )
    .eq('organization_id', organizationId)
    .order('recorded_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: 'Unable to load inspection data.' },
      { status: 500 }
    )
  }

  const rows = kpis ?? []

  const inspected = rows.map((kpi: any) => {
    const current = Number(kpi.value)

    const previous =
      kpi.previous_value === null || kpi.previous_value === undefined
        ? null
        : Number(kpi.previous_value)

    let changePercent: number | null = null

    if (
      previous !== null &&
      Number.isFinite(current) &&
      Number.isFinite(previous) &&
      previous !== 0
    ) {
      changePercent =
        Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10
    }

    const issues: string[] = []

    if (kpi.status === 'warning') {
      issues.push('Data quality warning')
    }

    if (previous !== null && changePercent !== null) {
      if (changePercent <= -20) {
        issues.push('Significant decline')
      } else if (changePercent >= 20) {
        issues.push('Significant increase')
      }
    }

    if (!kpi.source) {
      issues.push('Source not identified')
    }

    if (!kpi.recorded_at) {
      issues.push('Recording date unavailable')
    }

    return {
      id: kpi.id,
      name: kpi.name,
      current: Number.isFinite(current) ? current : null,
      previous,
      unit: kpi.unit,
      period: kpi.period,
      trend: kpi.trend,
      status: kpi.status,
      source: kpi.source,
      recordedAt: kpi.recorded_at,
      updatedAt: kpi.updated_at,
      changePercent,
      issues,
      inspectionStatus: issues.length ? 'attention' : 'verified',
    }
  })

  const attention = inspected.filter(
    (item) => item.inspectionStatus === 'attention'
  )

  const verified = inspected.filter(
    (item) => item.inspectionStatus === 'verified'
  )

  return NextResponse.json({
    inspected,
    summary: {
      total: inspected.length,
      verified: verified.length,
      attention: attention.length,
      coverage: inspected.length
        ? Math.round((verified.length / inspected.length) * 100)
        : 0,
    },
    message: inspected.length
      ? 'Inspection is based on verified organization-scoped KPI records.'
      : 'No verified KPI records are available for inspection yet.',
  })
    }
