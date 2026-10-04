import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { profile } = await getCurrentProfile(supabase)
    if (!profile?.organization_id) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const objectiveId = new URL(request.url).searchParams.get('objectiveId')?.trim()
    if (!objectiveId) return NextResponse.json({ error: 'objectiveId is required.' }, { status: 400 })

    const { data: objective, error: objectiveError } = await supabase
      .from('company_objectives')
      .select('*')
      .eq('id', objectiveId)
      .eq('organization_id', profile.organization_id)
      .maybeSingle()
    if (objectiveError) throw objectiveError
    if (!objective) return NextResponse.json({ error: 'Objective not found.' }, { status: 404 })

    const [{ data: runs, error: runsError }, { data: outcomes, error: outcomesError }] = await Promise.all([
      supabase
        .from('business_orchestration_runs')
        .select('id,status,approval_status,agent_run_ids,action_run_ids,evidence,result,error_message,created_at,completed_at')
        .eq('organization_id', profile.organization_id)
        .eq('objective_id', objectiveId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('business_outcomes')
        .select('id,title,outcome_type,baseline_value,current_value,unit,hours_saved,cost_avoided,revenue_impact,evidence_status,action_run_id,created_at')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
        .limit(100),
    ])
    if (runsError) throw runsError
    if (outcomesError) throw outcomesError

    const actionRunIds = new Set(
      (runs ?? []).flatMap((run) => Array.isArray(run.action_run_ids) ? run.action_run_ids.filter((id): id is string => typeof id === 'string') : []),
    )
    const linkedOutcomes = (outcomes ?? []).filter((outcome) => typeof outcome.action_run_id === 'string' && actionRunIds.has(outcome.action_run_id))
    const verifiedOutcomes = linkedOutcomes.filter((outcome) => ['measured', 'attributed'].includes(String(outcome.evidence_status)))
    const completedRuns = (runs ?? []).filter((run) => run.status === 'completed').length
    const failedRuns = (runs ?? []).filter((run) => run.status === 'failed').length
    const activeRuns = (runs ?? []).filter((run) => ['planning', 'awaiting_approval', 'executing'].includes(run.status)).length

    const target = objective.target_value ?? objective.target ?? null
    const current = objective.current_value ?? objective.current ?? null
    let progressPercent: number | null = null
    if (typeof target === 'number' && typeof current === 'number' && target !== 0) {
      progressPercent = Math.max(0, Math.min(100, (current / target) * 100))
    }

    return NextResponse.json({
      ok: true,
      objective: {
        id: objective.id,
        title: String(objective.title ?? objective.name ?? objective.description ?? 'Company objective'),
        description: String(objective.description ?? objective.details ?? ''),
        target,
        current,
        metric: objective.metric ?? objective.metric_name ?? objective.key_result ?? null,
      },
      progress: {
        percent: progressPercent,
        orchestrationRuns: runs?.length ?? 0,
        activeRuns,
        completedRuns,
        failedRuns,
        linkedOutcomes: linkedOutcomes.length,
        verifiedOutcomes: verifiedOutcomes.length,
        remainingGap: progressPercent == null ? null : Math.max(0, 100 - progressPercent),
      },
      outcomes: linkedOutcomes.slice(0, 20),
      nextRecommendedMove:
        activeRuns > 0
          ? 'Continue the governed orchestration run and resolve any pending approval.'
          : verifiedOutcomes.length > 0
            ? 'Review verified outcomes against the objective target and determine the next measurable move.'
            : completedRuns > 0
              ? 'Link measured or attributed business outcomes to completed action runs to establish objective evidence.'
              : 'Start a governed orchestration assessment for this objective.',
    })
  } catch (error) {
    console.error('[Business Orchestration] progress failed:', error)
    return NextResponse.json({ error: 'Unable to calculate objective progress.' }, { status: 500 })
  }
}
