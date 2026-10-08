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

    const [{ data, error }, { data: intelligenceSnapshot, error: intelligenceError }] = await Promise.all([
      supabase
        .from('business_outcomes')
        .select(outcomeSelect)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false }),
      supabase
        .from('company_intelligence_snapshots')
        .select('state,intelligence,captured_at')
        .eq('organization_id', organizationId)
        .eq('snapshot_type', 'company_state')
        .order('captured_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (error) throw error

    const intelligenceCore =
      !intelligenceError &&
      intelligenceSnapshot?.state &&
      typeof intelligenceSnapshot.state === 'object' &&
      intelligenceSnapshot.state.intelligenceCore &&
      typeof intelligenceSnapshot.state.intelligenceCore === 'object'
        ? intelligenceSnapshot.state.intelligenceCore
        : !intelligenceError &&
            intelligenceSnapshot?.intelligence &&
            typeof intelligenceSnapshot.intelligence === 'object' &&
            intelligenceSnapshot.intelligence.intelligenceCore &&
            typeof intelligenceSnapshot.intelligence.intelligenceCore === 'object'
          ? intelligenceSnapshot.intelligence.intelligenceCore
          : null

    return NextResponse.json({
      ok: true,
      outcomes: data ?? [],
      intelligenceCore: intelligenceCore ?? { available: false },
    })
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

    // When a verified outcome is attached to a completed action, immediately propagate
    // that evidence into the originating agent evaluation and durable learning.
    if (data && actionRunId && ['measured', 'attributed'].includes(String(data.evidence_status))) {
      const { data: actionRun } = await supabase
        .from('business_action_runs')
        .select('id,decision_id,status')
        .eq('id', actionRunId)
        .eq('organization_id', organizationId)
        .maybeSingle()

      const agentRunId = actionRun?.decision_id ?? null
      if (actionRun?.status === 'completed' && agentRunId) {
        const { data: agentRun } = await supabase
          .from('agent_runs')
          .select('id,agent_id')
          .eq('id', agentRunId)
          .eq('organization_id', organizationId)
          .maybeSingle()

        if (agentRun?.agent_id) {
          const { data: existingEvaluation } = await supabase
            .from('agent_evaluations')
            .select('evidence')
            .eq('run_id', agentRun.id)
            .eq('organization_id', organizationId)
            .maybeSingle()

          const existingEvidence = existingEvaluation?.evidence && typeof existingEvaluation.evidence === 'object'
            ? existingEvaluation.evidence as Record<string, unknown>
            : {}

          const { error: evaluationError } = await supabase.from('agent_evaluations').upsert({
            organization_id: organizationId,
            agent_id: agentRun.agent_id,
            run_id: agentRun.id,
            execution_success: true,
            outcome_linked: true,
            evidence: {
              ...existingEvidence,
              controlledActionExecution: 'completed',
              controlledActionRunId: actionRun.id,
              linkedOutcomeId: data.id,
              linkedOutcomeEvidenceStatus: data.evidence_status,
              linkedAt: new Date().toISOString(),
            },
          }, { onConflict: 'run_id' })

          if (evaluationError) throw evaluationError

          const { data: existingMemory } = await supabase.from('agent_memory')
            .select('id,memory_type,content,confidence,evidence_status,source_type,source_id')
            .eq('organization_id', organizationId)
            .eq('agent_id', agentRun.agent_id)
            .eq('source_type', 'outcome')
            .eq('source_id', data.id)
            .eq('memory_type', 'lesson')
            .is('superseded_at', null)
            .limit(1)
            .maybeSingle()

          if (!existingMemory) {
            await supabase.from('agent_memory').insert({
              organization_id: organizationId,
              agent_id: agentRun.agent_id,
              run_id: agentRun.id,
              memory_type: 'lesson',
              content: 'Verified business outcome from controlled agent action: ' + data.title +
                '. Evidence status: ' + data.evidence_status + '.',
              importance: 85,
              confidence: 90,
              evidence_status: data.evidence_status === 'measured' ? 'verified' : 'attributed',
              source_type: 'outcome',
              source_id: data.id,
              metadata: {
                actionRunId: actionRun.id,
                outcomeId: data.id,
                hoursSaved: data.hours_saved,
                costAvoided: data.cost_avoided,
                revenueImpact: data.revenue_impact,
                currency: data.currency,
              },
            })
          }
        }
      }
    }

    return NextResponse.json({ ok: true, outcome: data }, { status: 201 })
  } catch (error) {
    console.error('[Business Outcomes] POST failed:', error)
    return NextResponse.json({ error: 'Unable to record business outcome.' }, { status: 500 })
  }
}
