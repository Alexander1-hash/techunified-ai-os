import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

type Row = Record<string, unknown>

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((item): item is Row => Boolean(item) && typeof item === 'object') : []
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function countWhere(items: Row[], predicate: (item: Row) => boolean) {
  return items.filter(predicate).length
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { profile, error: profileError } = await getCurrentProfile(supabase)

    if (profileError) {
      return NextResponse.json({ error: 'Unable to verify organization membership.' }, { status: 500 })
    }

    const organizationId = profile?.organization_id
    if (!organizationId) {
      return NextResponse.json({ error: 'Authentication and organization membership required.' }, { status: 401 })
    }

    const [
      objectivesResult,
      orchestrationResult,
      approvalsResult,
      actionRunsResult,
      outcomesResult,
      intelligenceResult,
    ] = await Promise.all([
      supabase.from('company_objectives').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(100),
      supabase.from('business_orchestration_runs').select('id,objective_id,status,approval_status,action_run_ids,agent_run_ids,created_at,updated_at').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(200),
      supabase.from('agent_approvals').select('id,agent_run_id,status,action_type,title,reason,proposed_action,decision_evidence,reviewer_note,requested_at,reviewed_at,created_at').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(100),
      supabase.from('business_action_runs').select('id,decision_id,decision_type,decision_title,workflow_id,execution_id,status,input,evidence,output,error_message,started_at,completed_at,created_at,updated_at').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(100),
      supabase.from('business_outcomes').select('id,title,outcome_type,evidence_status,baseline_value,current_value,unit,hours_saved,cost_avoided,revenue_impact,implementation_cost,currency,source,period_start,period_end,action_run_id,created_at,updated_at').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(200),
      supabase.from('company_intelligence_snapshots').select('*').eq('organization_id', organizationId).eq('snapshot_type', 'company_state').order('computed_at', { ascending: false }).limit(1).maybeSingle(),
    ])

    const failedSource = [
      objectivesResult.error && 'objectives',
      orchestrationResult.error && 'orchestration',
      approvalsResult.error && 'approvals',
      actionRunsResult.error && 'actionRuns',
      outcomesResult.error && 'outcomes',
      intelligenceResult.error && 'intelligence',
    ].filter(Boolean)

    if (failedSource.length) {
      console.error('[Chief of Staff Briefing] Data sources failed:', failedSource)
      return NextResponse.json({
        error: 'The executive briefing could not load all required organization data.',
        failedSources: failedSource,
      }, { status: 500 })
    }

    const objectives = rows(objectivesResult.data)
    const orchestrationRuns = rows(orchestrationResult.data)
    const approvals = rows(approvalsResult.data)
    const actionRuns = rows(actionRunsResult.data)
    const outcomes = rows(outcomesResult.data)
    const pendingApprovals = countWhere(approvals, (item) => text(item.status).toLowerCase() === 'pending')
    const failedActions = countWhere(actionRuns, (item) => ['failed', 'error'].includes(text(item.status).toLowerCase()))
    const activeActions = countWhere(actionRuns, (item) => ['running', 'pending', 'queued'].includes(text(item.status).toLowerCase()))
    const measuredOutcomes = countWhere(outcomes, (item) => ['measured', 'attributed'].includes(text(item.evidence_status).toLowerCase()))
    const failedOrchestrationRuns = countWhere(orchestrationRuns, (item) => text(item.status).toLowerCase() === 'failed')
    const awaitingOrchestrationApproval = countWhere(orchestrationRuns, (item) => text(item.status).toLowerCase() === 'awaiting_approval' || text(item.approval_status).toLowerCase() === 'pending')

    const snapshot = intelligenceResult.data as Row | null
    const state = snapshot?.state && typeof snapshot.state === 'object' ? snapshot.state as Row : {}
    const intelligence = snapshot?.intelligence && typeof snapshot.intelligence === 'object' ? snapshot.intelligence as Row : {}
    const intelligenceCore = state.intelligenceCore && typeof state.intelligenceCore === 'object'
      ? state.intelligenceCore as Row
      : intelligence.intelligenceCore && typeof intelligence.intelligenceCore === 'object'
        ? intelligence.intelligenceCore as Row
        : { available: false }

    const nextMove = pendingApprovals > 0
      ? { action: 'Review pending approvals', reason: 'Human review is the next required control before proposed work can proceed.', evidence: 'live approval records', execution: 'awaiting human review', approval: 'required' }
      : failedActions + failedOrchestrationRuns > 0
        ? { action: 'Investigate failed execution', reason: 'Failed runs need diagnosis before retrying or scheduling additional work.', evidence: 'live execution records', execution: 'investigation required', approval: 'review before retry' }
        : measuredOutcomes === 0
          ? { action: 'Establish outcome baselines', reason: 'No measured or attributed outcomes are currently recorded; capture a baseline before claiming business impact.', evidence: 'outcome evidence gap', execution: 'no new action started', approval: 'not applicable' }
          : { action: 'Review objective progress', reason: 'Use current objective, execution, and outcome records to choose the next evidence-backed priority.', evidence: 'organization records', execution: 'not started', approval: 'check per action' }

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      summary: {
        objectiveCount: objectives.length,
        pendingApprovals,
        failedActions,
        activeActions,
        measuredOutcomes,
        failedOrchestrationRuns,
        awaitingOrchestrationApproval,
        orchestrationRunCount: orchestrationRuns.length,
      },
      nextMove,
      intelligenceCore,
      objectives,
      approvals,
      orchestrationRuns,
      actionRuns,
      outcomes,
      dataFreshness: {
        intelligenceComputedAt: snapshot?.computed_at ?? snapshot?.captured_at ?? null,
        oldestIncludedRecordAt: [
          ...objectives.map((item) => text(item.created_at)),
          ...orchestrationRuns.map((item) => text(item.created_at)),
          ...approvals.map((item) => text(item.created_at)),
          ...actionRuns.map((item) => text(item.created_at)),
          ...outcomes.map((item) => text(item.created_at)),
        ].filter(Boolean).sort()[0] ?? null,
      },
      safeguards: {
        organizationScoped: true,
        recommendationsExecuteActions: false,
        measuredOutcomesAreNotInvented: true,
      },
    })
  } catch (error) {
    console.error('[Chief of Staff Briefing] GET failed:', error)
    return NextResponse.json({ error: 'Unable to generate the Chief of Staff briefing.' }, { status: 500 })
  }
}
