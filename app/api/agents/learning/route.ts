import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).maybeSingle()
  const organizationId = profile?.organization_id
  if (!organizationId) return NextResponse.json({ error: 'Organization required.' }, { status: 400 })

  const body = await request.json().catch(() => null) as {
    runId?: string
    groundednessScore?: number
    toolAccuracyScore?: number
    humanFeedback?: string
    reviewerNote?: string
  } | null

  const runId = body?.runId?.trim()
  if (!runId) return NextResponse.json({ error: 'runId is required.' }, { status: 400 })

  const score = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100 ? value : null
  const groundednessScore = score(body?.groundednessScore)
  const toolAccuracyScore = score(body?.toolAccuracyScore)

  const { data: run } = await supabase
    .from('agent_runs')
    .select('id,agent_id,status,result,tool_calls')
    .eq('id', runId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!run) return NextResponse.json({ error: 'Agent run not found.' }, { status: 404 })

  const { data: linkedAction } = await supabase
    .from('business_action_runs')
    .select('id,status,output')
    .eq('organization_id', organizationId)
    .eq('decision_id', run.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: linkedOutcome } = linkedAction
    ? await supabase.from('business_outcomes')
        .select('id,title,evidence_status,action_run_id,hours_saved,cost_avoided,revenue_impact,currency')
        .eq('organization_id', organizationId)
        .eq('action_run_id', linkedAction.id)
        .in('evidence_status', ['measured','attributed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  const executionSuccess = linkedAction ? linkedAction.status === 'completed' : null
  const outcomeLinked = Boolean(linkedOutcome)

  const { data: evaluation, error: evaluationError } = await supabase
    .from('agent_evaluations')
    .upsert({
      organization_id: organizationId,
      agent_id: run.agent_id,
      run_id: run.id,
      evaluator_id: user.id,
      groundedness_score: groundednessScore,
      tool_accuracy_score: toolAccuracyScore,
      execution_success: executionSuccess,
      outcome_linked: outcomeLinked,
      human_feedback: body?.humanFeedback?.trim().slice(0, 4000) || null,
      reviewer_note: body?.reviewerNote?.trim().slice(0, 4000) || null,
      evidence: { linkedActionRunId: linkedAction?.id ?? null, linkedOutcomeId: linkedOutcome?.id ?? null },
    }, { onConflict: 'run_id' })
    .select('id,run_id,groundedness_score,tool_accuracy_score,execution_success,outcome_linked,human_feedback,reviewer_note,evidence,created_at,updated_at')
    .single()

  if (evaluationError || !evaluation) return NextResponse.json({ error: 'Unable to record agent evaluation.' }, { status: 500 })

  let learnedMemory = null
  if (linkedOutcome) {
    const content = 'Verified business outcome from agent run: ' + linkedOutcome.title +
      '. Evidence status: ' + linkedOutcome.evidence_status +
      '. This outcome is linked to action run ' + linkedAction!.id + '.'
    const { data: memory } = await supabase.from('agent_memory').insert({
      organization_id: organizationId,
      agent_id: run.agent_id,
      run_id: run.id,
      memory_type: 'lesson',
      content,
      importance: 85,
      confidence: 90,
      evidence_status: linkedOutcome.evidence_status === 'measured' ? 'verified' : 'attributed',
      source_type: 'outcome',
      source_id: linkedOutcome.id,
      metadata: {
        actionRunId: linkedAction!.id,
        outcomeId: linkedOutcome.id,
        hoursSaved: linkedOutcome.hours_saved,
        costAvoided: linkedOutcome.cost_avoided,
        revenueImpact: linkedOutcome.revenue_impact,
        currency: linkedOutcome.currency,
      },
    }).select('id,memory_type,content,confidence,evidence_status,source_type,source_id').single()
    learnedMemory = memory ?? null
  }

  return NextResponse.json({
    ok: true,
    evaluation,
    learning: learnedMemory
      ? { status: 'promoted', memory: learnedMemory }
      : { status: 'no_verified_outcome_yet', message: 'Evaluation recorded. Durable learning is promoted only when a measured or attributed business outcome is linked to the agent run.' },
  })
}
