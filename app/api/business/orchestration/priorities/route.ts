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

    const dependencyFirstSequence = [...scored].sort((a: any, b: any) => {
      const aBlocksOthers = scored.filter((candidate: any) => candidate.dependencies.includes(a.id)).length
      const bBlocksOthers = scored.filter((candidate: any) => candidate.dependencies.includes(b.id)).length
      if (aBlocksOthers !== bBlocksOthers) return bBlocksOthers - aBlocksOthers
      return b.priorityScore - a.priorityScore
    }).map((objective: any, index: number) => ({
      order: index + 1,
      objectiveId: objective.id,
      title: objective.title,
      priorityScore: objective.priorityScore,
      blocksObjectives: scored.filter((candidate: any) => candidate.dependencies.includes(objective.id)).length,
      blocked: objective.blockedDependencies.length > 0,
      recommended: objective.blockedDependencies.length === 0,
    }))

    const dependencyEdges = scored.flatMap((objective: any) => objective.dependencyDetails.map((dependency: any) => ({
      objectiveId: objective.id,
      objectiveTitle: objective.title,
      dependencyId: dependency.id,
      dependencyTitle: dependency.title,
      status: dependency.status,
    })))

    const downstreamCount = new Map<string, number>()
    scored.forEach((objective: any) => {
      objective.dependencies.forEach((dependencyId: string) => {
        downstreamCount.set(dependencyId, (downstreamCount.get(dependencyId) ?? 0) + 1)
      })
    })

    const criticalPath = [...scored]
      .filter((objective: any) => objective.blockedDependencies.length === 0)
      .sort((a: any, b: any) => {
        const aDownstream = downstreamCount.get(a.id) ?? 0
        const bDownstream = downstreamCount.get(b.id) ?? 0
        if (aDownstream !== bDownstream) return bDownstream - aDownstream
        if (a.priorityScore !== b.priorityScore) return b.priorityScore - a.priorityScore
        return a.title.localeCompare(b.title)
      })
      .map((objective: any, index: number) => ({
        order: index + 1,
        objectiveId: objective.id,
        title: objective.title,
        priorityScore: objective.priorityScore,
        downstreamObjectives: downstreamCount.get(objective.id) ?? 0,
        readiness: objective.capacity.executionPathAvailable ? 'ready' : 'capacity_gap',
        reason: (downstreamCount.get(objective.id) ?? 0) > 0
          ? 'Completing this objective can unblock downstream objectives'
          : objective.priorityReason,
      }))

    const activeOrchestrationRuns = (runs ?? []).filter((run: any) => ['planning', 'awaiting_approval', 'executing'].includes(String(run.status)))
    const pendingApprovalObjectives = new Set(
      (runs ?? []).filter((run: any) => String(run.approval_status) === 'pending').map((run: any) => String(run.objective_id)),
    )
    const activeObjectiveIds = new Set(activeOrchestrationRuns.map((run: any) => String(run.objective_id)))
    const failedObjectiveIds = new Set(
      (runs ?? []).filter((run: any) => String(run.status) === 'failed').map((run: any) => String(run.objective_id)),
    )

    const workloadIntelligence = scored.map((objective: any) => {
      const active = activeOrchestrationRuns.filter((run: any) => String(run.objective_id) === objective.id)
      const pendingApproval = pendingApprovalObjectives.has(objective.id)
      const failed = failedObjectiveIds.has(objective.id)
      const conflict = active.length > 0 || pendingApproval || failed || objective.blockedDependencies.length > 0
      const workloadState = failed
        ? 'review_required'
        : pendingApproval
          ? 'approval_pending'
          : active.length > 0
            ? 'work_in_progress'
            : objective.blockedDependencies.length > 0
              ? 'dependency_blocked'
              : objective.capacity.executionPathAvailable
                ? 'available'
                : 'capacity_limited'
      const recommendation = failed
        ? 'Investigate failed governed work before starting new work'
        : pendingApproval
          ? 'Resolve the pending approval before creating competing work'
          : active.length > 0
            ? 'Continue or complete the active governed work before duplicating effort'
            : objective.blockedDependencies.length > 0
              ? 'Resolve dependencies before orchestration'
              : objective.capacity.executionPathAvailable
                ? 'Available for governed orchestration'
                : 'Wait for an execution-capable worker and workflow'
      return {
        objectiveId: objective.id,
        title: objective.title,
        workloadState,
        conflict,
        activeRuns: active.length,
        pendingApproval,
        failedWork: failed,
        blockedDependencies: objective.blockedDependencies.length,
        recommendation,
      }
    })

    const workloadSummary = {
      activeObjectives: activeObjectiveIds.size,
      pendingApprovalObjectives: pendingApprovalObjectives.size,
      failedObjectives: failedObjectiveIds.size,
      conflictedObjectives: workloadIntelligence.filter((item: any) => item.conflict).length,
      availableObjectives: workloadIntelligence.filter((item: any) => item.workloadState === 'available').length,
    }

    const capacityAwareSequence = [...scored]
      .filter((objective: any) => objective.blockedDependencies.length === 0)
      .map((objective: any) => {
        const downstreamObjectives = downstreamCount.get(objective.id) ?? 0
        const activeWork = objective.activeRuns > 0
        const hasPendingApproval = objective.pendingApprovalRuns > 0
        const executionReady = objective.capacity.executionPathAvailable
        const readinessPenalty = executionReady ? 0 : 25
        const activePenalty = activeWork ? 15 : 0
        const approvalPenalty = hasPendingApproval ? 20 : 0
        const capacityScore = Math.max(0, Math.min(100,
          objective.priorityScore + downstreamObjectives * 10 - readinessPenalty - activePenalty - approvalPenalty,
        ))
        const reason = !executionReady
          ? 'Execution capacity is currently limited'
          : hasPendingApproval
            ? 'Governed approval is already pending'
            : activeWork
              ? 'Governed work is already active'
              : downstreamObjectives > 0
                ? 'Ready objective with downstream work to unblock'
                : 'Ready objective with the strongest available evidence signal'
        return {
          objectiveId: objective.id,
          title: objective.title,
          capacityScore,
          executionReady,
          downstreamObjectives,
          activeWork,
          pendingApproval: hasPendingApproval,
          reason,
        }
      })
      .sort((a: any, b: any) => {
        if (a.executionReady !== b.executionReady) return a.executionReady ? -1 : 1
        if (a.capacityScore !== b.capacityScore) return b.capacityScore - a.capacityScore
        return a.title.localeCompare(b.title)
      })
      .map((item: any, index: number) => ({ ...item, order: index + 1 }))

    const nextMove = workloadIntelligence.find((item: any) => item.pendingApproval)
      ? { action: 'resolve_approval', objectiveId: workloadIntelligence.find((item: any) => item.pendingApproval)?.objectiveId, reason: 'A governed approval is already pending and should be resolved before competing work is created.' }
      : workloadIntelligence.find((item: any) => item.failedWork)
        ? { action: 'investigate_failure', objectiveId: workloadIntelligence.find((item: any) => item.failedWork)?.objectiveId, reason: 'Failed governed work requires investigation before new execution is recommended.' }
        : workloadIntelligence.find((item: any) => item.blockedDependencies > 0)
          ? { action: 'resolve_dependency', objectiveId: workloadIntelligence.find((item: any) => item.blockedDependencies > 0)?.objectiveId, reason: 'A dependency is blocking objective progress.' }
          : workloadIntelligence.find((item: any) => item.activeRuns > 0)
            ? { action: 'continue_active_work', objectiveId: workloadIntelligence.find((item: any) => item.activeRuns > 0)?.objectiveId, reason: 'Governed work is already active; avoid duplicating effort.' }
            : capacityAwareSequence[0]
              ? { action: 'start_governed_assessment', objectiveId: capacityAwareSequence[0].objectiveId, reason: 'The highest-ranked unblocked objective is ready for governed assessment.' }
              : { action: 'review_portfolio', objectiveId: null, reason: 'No objective is currently ready for a governed next step.' }

    return NextResponse.json({ ok: true, objectives: scored, dependencyEdges, dependencyFirstSequence, criticalPath, capacityAwareSequence, workloadIntelligence, workloadSummary, nextMove, highestPriority: scored[0] ?? null })
  } catch (error) {
    console.error('[Business Orchestration] priorities failed:', error)
    return NextResponse.json({ error: 'Unable to prioritize objectives.' }, { status: 500 })
  }
}
