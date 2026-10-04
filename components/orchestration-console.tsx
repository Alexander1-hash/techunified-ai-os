'use client'

import { useEffect, useMemo, useState } from 'react'
import { BrainCircuit, Play, ShieldCheck, Target, Workflow } from 'lucide-react'
import { Card, Status } from '@/components/ui'

type AnyRecord = Record<string, any>

type Props = {
  objectives: AnyRecord[]
  initialRuns: AnyRecord[]
}

function objectiveTitle(objective: AnyRecord) {
  return String(objective.title ?? objective.name ?? objective.description ?? 'Untitled objective')
}

function objectiveDescription(objective: AnyRecord) {
  return String(objective.description ?? objective.details ?? objective.key_result ?? '')
}

export default function OrchestrationConsole({ objectives, initialRuns }: Props) {
  const [selectedObjectiveId, setSelectedObjectiveId] = useState(String(objectives[0]?.id ?? ''))
  const [runs, setRuns] = useState(initialRuns)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [progress, setProgress] = useState<AnyRecord | null>(null)
  const [priorities, setPriorities] = useState<AnyRecord | null>(null)

  const selectedObjective = useMemo(
    () => objectives.find((objective) => String(objective.id) === selectedObjectiveId) ?? null,
    [objectives, selectedObjectiveId],
  )

  const selectedRuns = useMemo(
    () => runs.filter((run) => String(run.objective_id) === selectedObjectiveId),
    [runs, selectedObjectiveId],
  )

  useEffect(() => {
    let cancelled = false
    fetch('/api/business/orchestration/priorities')
      .then(async (response) => {
        const json = await response.json()
        if (!response.ok) throw new Error(json.error || 'Unable to load objective priorities.')
        if (!cancelled) setPriorities(json)
      })
      .catch(() => {
        if (!cancelled) setPriorities(null)
      })
    return () => { cancelled = true }
  }, [runs])

  useEffect(() => {
    if (!selectedObjectiveId) {
      setProgress(null)
      return
    }
    let cancelled = false
    fetch(`/api/business/orchestration/progress?objectiveId=${encodeURIComponent(selectedObjectiveId)}`)
      .then(async (response) => {
        const json = await response.json()
        if (!response.ok) throw new Error(json.error || 'Unable to load objective progress.')
        if (!cancelled) setProgress(json)
      })
      .catch(() => {
        if (!cancelled) setProgress(null)
      })
    return () => { cancelled = true }
  }, [selectedObjectiveId, runs])

  async function createOrchestration() {
    if (!selectedObjectiveId) return
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/business/orchestration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectiveId: selectedObjectiveId }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Unable to create orchestration run.')
      setRuns((current) => [json.orchestrationRun, ...current.filter((run) => run.id !== json.orchestrationRun.id)])
      setMessage('Orchestration plan created. No workflow was executed.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create orchestration run.')
    } finally {
      setBusy(false)
    }
  }

  async function assess(runId: string) {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/business/orchestration/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orchestrationRunId: runId }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Unable to assess objective.')
      setRuns((current) => current.map((run) => run.id === runId ? json.orchestrationRun : run))
      setMessage('Governed AI assessment completed. Execution remains controlled and has not started.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to assess objective.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card><div className="flex items-center gap-3"><Target className="size-5 text-primary" /><div><p className="text-xs text-muted-foreground">Objectives</p><p className="text-2xl font-semibold">{objectives.length}</p></div></div></Card>
        <Card><div className="flex items-center gap-3"><BrainCircuit className="size-5 text-primary" /><div><p className="text-xs text-muted-foreground">Orchestration runs</p><p className="text-2xl font-semibold">{runs.length}</p></div></div></Card>
        <Card><div className="flex items-center gap-3"><ShieldCheck className="size-5 text-primary" /><div><p className="text-xs text-muted-foreground">Governance</p><p className="text-sm font-medium">Approval controls enforced</p></div></div></Card>
      </div>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div><h2 className="text-lg font-semibold">Governed next move</h2><p className="mt-1 text-sm text-muted-foreground">A single recommended next step based on approvals, failures, dependencies, active work, and capacity. Recommendation only; execution remains governed.</p></div>
        </div>
        <Card>
          {priorities?.nextMove ? (
            <button onClick={() => priorities.nextMove.objectiveId && setSelectedObjectiveId(String(priorities.nextMove.objectiveId))} className="w-full rounded-lg border p-4 text-left hover:bg-muted/40">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{String(priorities.nextMove.action).replace(/_/g, ' ')}</p><p className="mt-1 text-sm font-semibold">{String(priorities.nextMove.reason)}</p></div>
                {priorities.nextMove.objectiveId && <span className="rounded-full border px-3 py-1 text-xs font-medium">Open objective</span>}
              </div>
            </button>
          ) : <p className="text-sm text-muted-foreground">No governed next move is available yet.</p>}
        </Card>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div><h2 className="text-lg font-semibold">Objective priority</h2><p className="mt-1 text-sm text-muted-foreground">Evidence-based attention signals across company objectives. This is prioritization, not an ROI claim.</p></div>
        </div>
        <Card>
          {priorities?.highestPriority ? (
            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Highest priority</p><p className="mt-1 text-base font-semibold">{String(priorities.highestPriority.title)}</p><p className="mt-1 text-sm text-muted-foreground">{String(priorities.highestPriority.priorityReason)}</p></div>
                <span className="rounded-full border px-3 py-1 text-sm font-medium">Priority {String(priorities.highestPriority.priorityScore)}/100</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Active work</p><p className="mt-1 font-semibold">{priorities.highestPriority.activeRuns}</p></div>
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Pending approval</p><p className="mt-1 font-semibold">{priorities.highestPriority.pendingApprovalRuns}</p></div>
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Verified outcomes</p><p className="mt-1 font-semibold">{priorities.highestPriority.verifiedOutcomes}</p></div>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Execution readiness</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  <div><p className="text-xs text-muted-foreground">Active AI workers</p><p className="mt-1 font-semibold">{priorities.highestPriority.capacity?.activeAgents ?? 0}</p></div>
                  <div><p className="text-xs text-muted-foreground">Active workflows</p><p className="mt-1 font-semibold">{priorities.highestPriority.capacity?.activeWorkflows ?? 0}</p></div>
                  <div><p className="text-xs text-muted-foreground">Execution path</p><p className="mt-1 font-semibold">{priorities.highestPriority.capacity?.executionPathAvailable ? 'Available' : 'Gap detected'}</p></div>
                </div>
                {Array.isArray(priorities.highestPriority.blockedDependencies) && priorities.highestPriority.blockedDependencies.length > 0 && (
                  <p className="mt-3 text-xs text-muted-foreground">Blocked dependencies detected: {priorities.highestPriority.blockedDependencies.length}. TechUnified will keep execution governed rather than inventing a workaround.</p>
                )}
              </div>
            </div>
          ) : <p className="text-sm text-muted-foreground">No objective priority signal is available yet.</p>}
        </Card>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div><h2 className="text-lg font-semibold">Objective portfolio</h2><p className="mt-1 text-sm text-muted-foreground">A governed portfolio view showing which objectives need attention and why. Scores are operational prioritization signals, not financial valuations.</p></div>
        </div>
        <Card>
          {Array.isArray(priorities?.objectives) && priorities.objectives.length > 0 ? (
            <div className="space-y-2">
              {priorities.objectives.map((objective: AnyRecord, index: number) => (
                <button key={objective.id} onClick={() => setSelectedObjectiveId(String(objective.id))} className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/40">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0"><div className="flex items-center gap-2"><span className="text-xs font-medium text-muted-foreground">#{index + 1}</span><span className="truncate text-sm font-semibold">{String(objective.title)}</span></div><p className="mt-1 text-xs text-muted-foreground">{String(objective.priorityReason)}</p></div>
                    <div className="flex shrink-0 flex-wrap gap-2 text-[11px] text-muted-foreground"><span className="rounded-full border px-2 py-1">Priority {String(objective.priorityScore)}/100</span><span className="rounded-full border px-2 py-1">Active {String(objective.activeRuns ?? 0)}</span><span className="rounded-full border px-2 py-1">{objective.capacity?.executionPathAvailable ? 'Ready path' : 'Capacity gap'}</span></div>
                  </div>
                </button>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No objective portfolio signals are available yet.</p>}
        </Card>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div><h2 className="text-lg font-semibold">Dependency intelligence</h2><p className="mt-1 text-sm text-muted-foreground">Portfolio-level dependencies are visible before TechUnified recommends work. Unresolved or failed dependencies remain explicit blockers.</p></div>
        </div>
        <Card>
          {Array.isArray(priorities?.dependencyEdges) && priorities.dependencyEdges.length > 0 ? (
            <div className="space-y-2">
              {priorities.dependencyEdges.map((edge: AnyRecord, index: number) => (
                <div key={String(edge.objectiveId) + String(edge.dependencyId) + index} className="rounded-lg border p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div><p className="text-sm font-medium">{String(edge.objectiveTitle)} <span className="text-muted-foreground">depends on</span> {String(edge.dependencyTitle)}</p></div>
                    <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">{String(edge.status)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No explicit objective dependencies are currently recorded.</p>}
        </Card>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div><h2 className="text-lg font-semibold">Recommended objective sequence</h2><p className="mt-1 text-sm text-muted-foreground">Dependency-aware ordering helps TechUnified work on objectives that unblock other objectives first. This is a planning signal, not automatic execution.</p></div>
        </div>
        <Card>
          {Array.isArray(priorities?.dependencyFirstSequence) && priorities.dependencyFirstSequence.length > 0 ? (
            <div className="space-y-2">
              {priorities.dependencyFirstSequence.map((item: AnyRecord) => (
                <button key={String(item.objectiveId)} onClick={() => setSelectedObjectiveId(String(item.objectiveId))} className="w-full rounded-lg border p-3 text-left hover:bg-muted/40">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold"><span className="mr-2 text-xs text-muted-foreground">#{String(item.order)}</span>{String(item.title)}</p><p className="mt-1 text-xs text-muted-foreground">{item.blocksObjectives > 0 ? ('Unblocks ' + String(item.blocksObjectives) + ' other objective' + (item.blocksObjectives === 1 ? '' : 's')) : 'No downstream objectives detected'}</p></div><span className="rounded-full border px-2.5 py-1 text-xs">{item.blocked ? 'Blocked' : item.recommended ? 'Ready to prioritize' : 'Review'}</span></div>
                </button>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No objective sequencing signal is available yet.</p>}
        </Card>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div><h2 className="text-lg font-semibold">Critical path intelligence</h2><p className="mt-1 text-sm text-muted-foreground">Highlights unblocked objectives that can unlock downstream work. TechUnified uses this as decision support, not as automatic execution authority.</p></div>
        </div>
        <Card>
          {Array.isArray(priorities?.criticalPath) && priorities.criticalPath.length > 0 ? (
            <div className="space-y-2">
              {priorities.criticalPath.map((item: AnyRecord) => (
                <button key={String(item.objectiveId)} onClick={() => setSelectedObjectiveId(String(item.objectiveId))} className="w-full rounded-lg border p-3 text-left hover:bg-muted/40">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold"><span className="mr-2 text-xs text-muted-foreground">#{String(item.order)}</span>{String(item.title)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{String(item.reason)}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded-full border px-2 py-1">Unblocks {String(item.downstreamObjectives ?? 0)}</span>
                      <span className="rounded-full border px-2 py-1">{String(item.readiness) === 'ready' ? 'Ready path' : 'Capacity gap'}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No unblocked critical-path signal is available yet.</p>}
        </Card>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div><h2 className="text-lg font-semibold">Objective workload intelligence</h2><p className="mt-1 text-sm text-muted-foreground">Detects competing work, pending approvals, failures, dependency blockers, and available execution capacity before new orchestration begins.</p></div>
        </div>
        <Card>
          <div className="mb-4 grid gap-2 sm:grid-cols-5">
            {(['activeObjectives','pendingApprovalObjectives','failedObjectives','conflictedObjectives','availableObjectives'] as const).map((key) => (
              <div key={key} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{key.replace(/([A-Z])/g, ' $1')}</p><p className="text-xl font-semibold">{String(priorities?.workloadSummary?.[key] ?? 0)}</p></div>
            ))}
          </div>
          {Array.isArray(priorities?.workloadIntelligence) && priorities.workloadIntelligence.length > 0 ? (
            <div className="space-y-2">
              {priorities.workloadIntelligence.map((item: AnyRecord) => (
                <button key={String(item.objectiveId)} onClick={() => setSelectedObjectiveId(String(item.objectiveId))} className="w-full rounded-lg border p-3 text-left hover:bg-muted/40">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div><p className="text-sm font-semibold">{String(item.title)}</p><p className="mt-1 text-xs text-muted-foreground">{String(item.recommendation)}</p></div>
                    <span className="rounded-full border px-2 py-1 text-[11px]">{String(item.workloadState).replace(/_/g, ' ')}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No workload intelligence is available yet.</p>}
        </Card>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div><h2 className="text-lg font-semibold">Capacity-aware next work</h2><p className="mt-1 text-sm text-muted-foreground">Combines dependency readiness, downstream impact, current governed work, approvals, and available execution capacity.</p></div>
        </div>
        <Card>
          {Array.isArray(priorities?.capacityAwareSequence) && priorities.capacityAwareSequence.length > 0 ? (
            <div className="space-y-2">
              {priorities.capacityAwareSequence.map((item: AnyRecord) => (
                <button key={String(item.objectiveId)} onClick={() => setSelectedObjectiveId(String(item.objectiveId))} className="w-full rounded-lg border p-3 text-left hover:bg-muted/40">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold"><span className="mr-2 text-xs text-muted-foreground">#{String(item.order)}</span>{String(item.title)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{String(item.reason)}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded-full border px-2 py-1">Score {String(item.capacityScore)}/100</span>
                      <span className="rounded-full border px-2 py-1">{item.executionReady ? 'Execution ready' : 'Capacity limited'}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No capacity-aware sequence is available yet.</p>}
        </Card>
      </section>

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Objective</p>
            <select
              value={selectedObjectiveId}
              onChange={(event) => setSelectedObjectiveId(event.target.value)}
              className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm sm:min-w-[360px]"
              disabled={!objectives.length}
            >
              {objectives.length === 0 && <option value="">No objectives available</option>}
              {objectives.map((objective) => <option key={objective.id} value={objective.id}>{objectiveTitle(objective)}</option>)}
            </select>
            {selectedObjective && objectiveDescription(selectedObjective) && (
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{objectiveDescription(selectedObjective)}</p>
            )}
          </div>
          <button
            onClick={createOrchestration}
            disabled={busy || !selectedObjectiveId}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play size={16} />
            Start governed planning
          </button>
        </div>
        {message && <p className="mt-4 rounded-lg border bg-muted/30 px-3 py-2 text-sm">{message}</p>}
      </Card>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div><h2 className="text-lg font-semibold">Objective progress</h2><p className="mt-1 text-sm text-muted-foreground">Progress is derived from objective fields and verified evidence already recorded in TechUnified.</p></div>
        </div>
        <Card>
          {progress ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div><p className="text-xs text-muted-foreground">Target</p><p className="mt-1 text-lg font-semibold">{progress.objective?.target ?? 'Not defined'}</p></div>
                <div><p className="text-xs text-muted-foreground">Current</p><p className="mt-1 text-lg font-semibold">{progress.objective?.current ?? 'Not defined'}</p></div>
                <div><p className="text-xs text-muted-foreground">Verified outcomes</p><p className="mt-1 text-lg font-semibold">{progress.progress?.verifiedOutcomes ?? 0}</p></div>
                <div><p className="text-xs text-muted-foreground">Completed runs</p><p className="mt-1 text-lg font-semibold">{progress.progress?.completedRuns ?? 0}</p></div>
              </div>
              {typeof progress.progress?.percent === 'number' && (
                <div>
                  <div className="mb-2 flex justify-between text-xs text-muted-foreground"><span>Target progress</span><span>{Math.round(progress.progress.percent)}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${progress.progress.percent}%` }} /></div>
                </div>
              )}
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Decision intelligence</p>
                <p className="mt-1 text-sm font-medium">{String(progress.decisionIntelligence?.recommendation ?? progress.nextRecommendedMove ?? '')}</p>
                <p className="mt-1 text-xs text-muted-foreground">{String(progress.decisionIntelligence?.reason ?? '')}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  <span className="rounded-full border px-2 py-1">Evidence: {String(progress.decisionIntelligence?.evidence ?? 'objective_record')}</span>
                  <span className="rounded-full border px-2 py-1">Grounded: {progress.decisionIntelligence?.grounded ? 'Yes' : 'No'}</span>
                  <span className="rounded-full border px-2 py-1">Execution: not started</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Objective progress is not available yet.</p>
          )}
        </Card>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div><h2 className="text-lg font-semibold">Objective orchestration</h2><p className="mt-1 text-sm text-muted-foreground">Planning and assessment happen before any controlled workflow execution.</p></div>
        </div>
        {selectedRuns.length === 0 ? (
          <Card><p className="py-8 text-center text-sm text-muted-foreground">No orchestration runs for this objective yet.</p></Card>
        ) : (
          <div className="space-y-3">
            {selectedRuns.map((run) => (
              <Card key={run.id}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Status value={run.status} />
                      <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">Approval: {run.approval_status}</span>
                    </div>
                    <p className="mt-3 text-sm font-medium">Run {String(run.id).slice(0, 8)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(run.created_at).toLocaleString()}</p>
                    {run.plan?.nextStep && <p className="mt-3 text-sm text-muted-foreground">Next: {String(run.plan.nextStep)}</p>}
                    {run.result?.agentAssessment && <div className="mt-3 rounded-lg border bg-muted/20 p-3 text-sm whitespace-pre-wrap">{String(run.result.agentAssessment)}</div>}
                  </div>
                  {run.status === 'planning' && (
                    <button
                      onClick={() => assess(run.id)}
                      disabled={busy}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                    >
                      <BrainCircuit size={16} />
                      Run AI assessment
                    </button>
                  )}
                  {run.status === 'awaiting_approval' && (
                    <div className="inline-flex shrink-0 items-center gap-2 rounded-lg border px-4 py-2 text-sm text-muted-foreground">
                      <ShieldCheck size={16} />
                      Awaiting approval
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Card>
        <div className="flex items-center gap-3"><Workflow className="size-5 text-primary" /><div><p className="text-sm font-medium">Controlled execution boundary</p><p className="mt-1 text-xs text-muted-foreground">This console can create plans and request governed AI assessments. It does not execute workflows directly; Phase 2 approval and action-run controls remain the execution boundary.</p></div></div>
      </Card>
    </div>
  )
}
