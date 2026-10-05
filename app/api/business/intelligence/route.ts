import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

export async function GET() {
  try {
    const supabase = await createClient()
    const { profile } = await getCurrentProfile(supabase)
    if (!profile?.organization_id) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    const organizationId = profile.organization_id

    const [{ data: objectives }, { data: runs }, { data: outcomes }, { data: agents }, { data: workflows }, { data: evaluations }] = await Promise.all([
      supabase.from('company_objectives').select('id,status,target_value,current_value').eq('organization_id', organizationId).limit(200),
      supabase.from('business_orchestration_runs').select('id,objective_id,status,approval_status,created_at').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(300),
      supabase.from('business_outcomes').select('id,action_run_id,evidence_status,hours_saved,cost_avoided,revenue_impact').eq('organization_id', organizationId).limit(300),
      supabase.from('agents').select('id,status').eq('organization_id', organizationId).in('status', ['active', 'running']).limit(100),
      supabase.from('workflows').select('id,status').eq('organization_id', organizationId).eq('status', 'active').limit(100),
      supabase.from('agent_evaluations').select('id,execution_success,outcome_linked').eq('organization_id', organizationId).limit(300),
    ])

    const objectiveIds = new Set((objectives ?? []).map((item: any) => String(item.id)))
    const activeRuns = (runs ?? []).filter((run: any) => ['planning', 'awaiting_approval', 'executing'].includes(String(run.status)))
    const failedRuns = (runs ?? []).filter((run: any) => run.status === 'failed')
    const pendingApprovals = (runs ?? []).filter((run: any) => run.status === 'awaiting_approval' || run.approval_status === 'pending')
    const verifiedOutcomes = (outcomes ?? []).filter((outcome: any) => ['measured', 'attributed'].includes(String(outcome.evidence_status)))
    const successfulEvaluations = (evaluations ?? []).filter((evaluation: any) => evaluation.execution_success === true && evaluation.outcome_linked === true)

    const state = {
      objectiveCount: objectiveIds.size,
      activeOrchestrationRuns: activeRuns.length,
      failedOrchestrationRuns: failedRuns.length,
      pendingApprovals: pendingApprovals.length,
      verifiedOutcomes: verifiedOutcomes.length,
      activeAgents: (agents ?? []).length,
      activeWorkflows: (workflows ?? []).length,
      successfulVerifiedEvaluations: successfulEvaluations.length,
      executionCapacityAvailable: (agents ?? []).length > 0 && (workflows ?? []).length > 0,
      intelligenceLoop: 'objective → assessment → approval → action → outcome → learning',
    }

    const confidence = verifiedOutcomes.length > 0 ? 'high' : (runs ?? []).length > 0 || (evaluations ?? []).length > 0 ? 'medium' : 'low'
    const evidence = [
      { source: 'company_objectives', count: objectiveIds.size },
      { source: 'business_orchestration_runs', count: runs?.length ?? 0 },
      { source: 'business_outcomes', verified: verifiedOutcomes.length },
      { source: 'agent_evaluations', verifiedLearning: successfulEvaluations.length },
    ]

    const signals = [
      ...(pendingApprovals.length > 0 ? [{ type: 'governance', severity: 'high', title: 'Governed approvals require attention', reason: 'One or more controlled actions are waiting for human approval.' }] : []),
      ...(failedRuns.length > 0 ? [{ type: 'risk', severity: 'high', title: 'Failed governed work detected', reason: 'Failed orchestration runs require investigation before new execution.' }] : []),
      ...((runs ?? []).length > 0 && verifiedOutcomes.length === 0 ? [{ type: 'evidence_gap', severity: 'medium', title: 'Evidence gap detected', reason: 'Work exists without measured or attributed outcome evidence.' }] : []),
      ...(successfulEvaluations.length > 0 ? [{ type: 'opportunity', severity: 'medium', title: 'Verified learning signal available', reason: 'Successful agent evaluations linked to outcomes can inform future prioritization.' }] : []),
      ...((agents ?? []).length > 0 && (workflows ?? []).length === 0 ? [{ type: 'capacity', severity: 'medium', title: 'Workflow capacity gap', reason: 'AI workers are available but no active workflow execution path is currently available.' }] : []),
    ]

    const signalConfidence = signals.some((signal) => signal.severity === 'high') ? 'high' : signals.length > 0 ? 'medium' : 'low'

    const { data: snapshot, error } = await supabase.from('company_intelligence_snapshots').insert({
      organization_id: organizationId,
      snapshot_type: 'company_state',
      state: { ...state, signalCount: signals.length, signals },
      confidence,
      evidence: [...evidence, { source: 'derived_signals', count: signals.length }],
    }).select('id,snapshot_type,state,confidence,evidence,computed_at').single()

    if (error) throw error
    return NextResponse.json({ ok: true, snapshot, signals, signalConfidence })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to compute company intelligence.' }, { status: 500 })
  }
}
