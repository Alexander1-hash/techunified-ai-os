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

  const { data: rows, error } = await supabase
    .from('business_kpis')
    .select(
      'id,name,value,previous_value,unit,period,trend,status,source,recorded_at,updated_at'
    )
    .eq('organization_id', organizationId)
    .order('recorded_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: 'Unable to load forecast data.' },
      { status: 500 }
    )
  }

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
      history.length >= 3
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
    message:
      forecasts.length > 0
        ? 'Forecasts are based on verified organization KPI records.'
        : 'More verified historical KPI data is required before TechUnified can produce a forecast.',
  })
      }
