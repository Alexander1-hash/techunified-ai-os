import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

export async function GET() {
  try {
    const supabase = await createClient()
    const { profile } = await getCurrentProfile(supabase)
    if (!profile?.organization_id) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const [{ data: objectives, error: objectiveError }, { data: runs, error: runError }, { data: outcomes, error: outcomeError }, { data: agents, error: agentsError }, { data: workflows, error: workflowsError }] = await Promise.all([
      supabase.from('company_objectives').select('*').eq('organization_id', profile.organization_id).order('created_at', { ascending: false }).limit(50),
      supabase.from('business_orchestration_runs').select('id,objective_id,status,approval_status,action_run_ids,created_at').eq('organization_id', profile.organization_id).order('created_at', { ascending: false }).limit(200),
      supabase.from('business_outcomes').select('id,action_run_id,evidence_status,cost_avoided,revenue_impact,hours_saved,created_at').eq('organization_id', profile.organization_id).order('created_at', { ascending: false }).limit(200),
      supabase.from('agents').select('id,name,status,autonomy_level').eq('organization_id', profile.organization_id).in('status', ['active', 'running']).limit(50),
      supabase.from('workflows').select('id,name,status').eq('organization_id', profile.organization_id).eq('status', 'active').limit(50),
    ])
    if (objectiveError || runError || outcomeError || agentsError || workflowsError) throw objectiveError || runError || outcomeError || agentsError || workflowsError

    const objectiveIndex = new Map((objectives ?? []).map((objective: any) => [String(objective.id), objective]))

    const scored = (objectives ?? []).map((objective: any) => {
      const objectiveRuns = (runs ?? []).filter((run: any) => run.objective_id === objective.id)
      const actionIds = new Set(objectiveRuns.flatMap((run: any) => Array.isArray(run.action_run_ids) ? run.action_run_ids : []).filter((id: any): id is string => typeof id === 'string'))
      const verified = (outcomes ?? []).filter((outcome: any) => typeof outcome.action_run_id === 'string' && actionIds.has(outcome.action_run_id) && ['measured', 'attributed'].includes(String(outcome.evidence_status)))
      const pendingApproval = objectiveRuns.filter((run: any) => run.status === 'awaiting_approval' || run.approval_status === 'pending').length
      const failed = objectiveRuns.filter((run: any) => run.status === 'failed').length
      const active = objectiveRuns.filter((run: any) => ['planning', 'awaiting_approval', 'executing'].includes(run.status)).length
      const completed = objectiveRuns.filter((run: any) => run.status === 'completed').length
      const target = objective.target_value ?? objective.target ?? null
      const current = objective.current_value ?? objective.current ?? null
      const progress = typeof target === 'number' && typeof current === 'number' && target !== 0 ? Math.max(0, Math.min(100, (current / target) * 100)) : null
      const explicitDependencies = Array.isArray(objective.dependencies) ? objective.dependencies : []
      const dependencyIds = explicitDependencies.filter((id: any): id is string => typeof id === 'string')
      const dependencyDetails = dependencyIds.map((dependencyId: string) => {
        const dependencyObjective = objectiveIndex.get(dependencyId)
        const dependencyRuns = (runs ?? []).filter((run: any) => run.objective_id === dependencyId)
        const failed = dependencyRuns.some((run: any) => run.status === 'failed')
        const completed = dependencyRuns.some((run: any) => run.status === 'completed')
        return {
          id: dependencyId,
          title: dependencyObjective ? String(dependencyObjective.title ?? dependencyObjective.name ?? dependencyObjective.description ?? 'Objective') : 'Unknown objective',
          status: failed ? 'failed' : completed ? 'completed' : 'unresolved',
          exists: Boolean(dependencyObjective),
        }
      })
      const blockedDependencies = dependencyIds.filter((dependencyId: string) => {
        const dependencyRuns = (runs ?? []).filter((run: any) => run.objective_id === dependencyId)
        return dependencyRuns.some((run: any) => run.status === 'failed') || !dependencyRuns.some((run: any) => run.status === 'completed')
      })
      const capacityAvailable = (agents?.length ?? 0) > 0 && (workflows?.length ?? 0) > 0
      let priorityScore = 20
      if (blockedDependencies.length > 0) priorityScore += 20
      if (!capacityAvailable) priorityScore += 15
      if (pendingApproval > 0) priorityScore += 35
      if (failed > 0) priorityScore += 25
      if (active > 0) priorityScore += 15
      if (completed > 0 && verified.length === 0) priorityScore += 20
      if (verified.length > 0) priorityScore += 5
      if (progress !== null && progress < 50) priorityScore += 15
      priorityScore = Math.min(100, priorityScore)
      const reason = blockedDependencies.length > 0 ? 'Blocked by an unresolved objective dependency' : !capacityAvailable ? 'No active AI worker and workflow execution capacity is available' : pendingApproval > 0 ? 'Pending governed approval' : failed > 0 ? 'Failed objective work needs review' : completed > 0 && verified.length === 0 ? 'Completed work lacks verified outcome evidence' : progress !== null && progress < 50 ? 'Objective is materially below its target' : active > 0 ? 'Active governed work is underway' : 'Objective has limited current evidence'
      return {
        id: objective.id,
        title: String(objective.title ?? objective.name ?? objective.description ?? 'Company objective'),
        description: String(objective.description ?? objective.details ?? ''),
        priorityScore,
        priorityReason: reason,
        progressPercent: progress,
        activeRuns: active,
        pendingApprovalRuns: pendingApproval,
        failedRuns: failed,
        completedRuns: completed,
        verifiedOutcomes: verified.length,
        evidenceState: verified.length ? 'verified_evidence_available' : completed ? 'evidence_gap' : 'limited_evidence',
        dependencies: dependencyIds,
        dependencyDetails,
        blockedDependencies,
        capacity: {
          activeAgents: agents?.length ?? 0,
          activeWorkflows: workflows?.length ?? 0,
          executionPathAvailable: capacityAvailable,
        },
      }
    }).sort((a: any, b: any) => b.priorityScore - a.priorityScore)

    const dependencyEdges = scored.flatMap((objective: any) => objective.dependencyDetails.map((dependency: any) => ({
      objectiveId: objective.id,
      objectiveTitle: objective.title,
      dependencyId: dependency.id,
      dependencyTitle: dependency.title,
      status: dependency.status,
    })))

    return NextResponse.json({ ok: true, objectives: scored, dependencyEdges, highestPriority: scored[0] ?? null })
  } catch (error) {
    console.error('[Business Orchestration] priorities failed:', error)
    return NextResponse.json({ error: 'Unable to prioritize objectives.' }, { status: 500 })
  }
}
