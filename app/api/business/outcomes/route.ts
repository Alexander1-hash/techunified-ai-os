import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

type OutcomeInput = {
  title: string
  outcome_type: string
  baseline_value?: number | null
  current_value?: number | null
  unit?: string | null
  hours_saved?: number
  cost_avoided?: number
  revenue_impact?: number
  implementation_cost?: number
  currency?: string
  evidence_status?: string
  source?: string | null
  notes?: string | null
  period_start?: string | null
  period_end?: string | null
  action_run_id?: string | null
}

function numberOrZero(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

async function getContext() {
  const supabase = await createClient()
  const { profile } = await getCurrentProfile(supabase)

  return {
    supabase,
    userId: profile?.id ?? null,
    organizationId: profile?.organization_id ?? null,
  }
}

const outcomeSelect =
  'id,title,outcome_type,baseline_value,current_value,unit,hours_saved,cost_avoided,revenue_impact,implementation_cost,currency,evidence_status,source,notes,period_start,period_end,action_run_id,created_at,updated_at'

export async function GET() {
  try {
    const { supabase, organizationId } = await getContext()

    if (!organizationId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('business_outcomes')
      .select(outcomeSelect)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ ok: true, outcomes: data ?? [] })
  } catch (error) {
    console.error('[Business Outcomes] GET failed:', error)
    return NextResponse.json({ error: 'Unable to load business outcomes.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId, organizationId } = await getContext()

    if (!organizationId || !userId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const body = (await request.json()) as OutcomeInput
    const title = body.title?.trim()

    if (!title) {
      return NextResponse.json({ error: 'Outcome title is required.' }, { status: 400 })
    }

    const allowedTypes = [
      'cost_saving',
      'productivity',
      'revenue_opportunity',
      'efficiency',
      'error_reduction',
      'risk_reduction',
      'other',
    ]
    const allowedEvidence = ['measured', 'estimated', 'attributed']

    if (!allowedTypes.includes(body.outcome_type)) {
      return NextResponse.json({ error: 'Invalid outcome type.' }, { status: 400 })
    }

    if (!allowedEvidence.includes(body.evidence_status ?? 'estimated')) {
      return NextResponse.json({ error: 'Invalid evidence status.' }, { status: 400 })
    }

    let actionRunId: string | null = null

    if (body.action_run_id?.trim()) {
      const { data: actionRun, error: actionRunError } = await supabase
        .from('business_action_runs')
        .select('id,status')
        .eq('id', body.action_run_id.trim())
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (actionRunError) throw actionRunError

      if (!actionRun) {
        return NextResponse.json({ error: 'Action run not found.' }, { status: 404 })
      }

      if (actionRun.status !== 'completed') {
        return NextResponse.json(
          { error: 'Only completed action runs can receive measured or attributed outcomes.' },
          { status: 409 },
        )
      }

      actionRunId = actionRun.id
    }

    const { data, error } = await supabase
      .from('business_outcomes')
      .insert({
        organization_id: organizationId,
        created_by: userId,
        title,
        outcome_type: body.outcome_type,
        baseline_value: body.baseline_value ?? null,
        current_value: body.current_value ?? null,
        unit: body.unit?.trim() || null,
        hours_saved: numberOrZero(body.hours_saved),
        cost_avoided: numberOrZero(body.cost_avoided),
        revenue_impact: numberOrZero(body.revenue_impact),
        implementation_cost: numberOrZero(body.implementation_cost),
        currency: body.currency?.trim() || 'NGN',
        evidence_status: body.evidence_status ?? 'estimated',
        source: body.source?.trim() || null,
        notes: body.notes?.trim() || null,
        period_start: body.period_start || null,
        period_end: body.period_end || null,
        action_run_id: actionRunId,
      })
      .select(outcomeSelect)
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, outcome: data }, { status: 201 })
  } catch (error) {
    console.error('[Business Outcomes] POST failed:', error)
    return NextResponse.json({ error: 'Unable to record business outcome.' }, { status: 500 })
  }
}
