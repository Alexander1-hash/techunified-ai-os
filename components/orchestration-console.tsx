'use client'

import { useMemo, useState } from 'react'
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

  const selectedObjective = useMemo(
    () => objectives.find((objective) => String(objective.id) === selectedObjectiveId) ?? null,
    [objectives, selectedObjectiveId],
  )

  const selectedRuns = useMemo(
    () => runs.filter((run) => String(run.objective_id) === selectedObjectiveId),
    [runs, selectedObjectiveId],
  )

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
