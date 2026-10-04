'use client'

import { useEffect, useState } from 'react'
import { BrainCircuit, CheckCircle2, CircleAlert, Gauge } from 'lucide-react'

type Evaluation = {
  id: string
  run_id: string
  agent_id: string
  groundedness_score: number | null
  tool_accuracy_score: number | null
  execution_success: boolean | null
  outcome_linked: boolean
  human_feedback: string | null
  reviewer_note: string | null
  created_at: string
}

type Run = {
  id: string
  task: string
  status: string
  result: { text?: string } | null
  created_at: string
}

type Agent = {
  id: string
  name: string
}

export default function AgentLearningConsole({ agents }: { agents: Agent[] }) {
  const [agentId, setAgentId] = useState(agents[0]?.id ?? '')
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [selectedRun, setSelectedRun] = useState('')
  const [groundedness, setGroundedness] = useState('')
  const [toolAccuracy, setToolAccuracy] = useState('')
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function load() {
    const [evalResponse, runResponse] = await Promise.all([
      fetch('/api/agents/learning?agentId=' + encodeURIComponent(agentId), { cache: 'no-store' }),
      fetch('/api/agents/run?agentId=' + encodeURIComponent(agentId), { cache: 'no-store' }),
    ])
    const evalJson = await evalResponse.json().catch(() => ({}))
    const runJson = await runResponse.json().catch(() => ({}))
    setEvaluations(evalJson.evaluations ?? [])
    setRuns(runJson.runs ?? [])
  }

  useEffect(() => {
    if (!agents.some((agent) => agent.id === agentId)) {
      setAgentId(agents[0]?.id ?? '')
    }
  }, [agents, agentId])

  useEffect(() => {
    if (agentId) void load()
  }, [agentId])

  async function evaluate() {
    if (!selectedRun || busy) return
    setBusy(true)
    setMessage('')
    const response = await fetch('/api/agents/learning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        runId: selectedRun,
        groundednessScore: groundedness ? Number(groundedness) : undefined,
        toolAccuracyScore: toolAccuracy ? Number(toolAccuracy) : undefined,
        humanFeedback: feedback.trim() || undefined,
      }),
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) setMessage(json.error ?? 'Unable to record evaluation.')
    else {
      setMessage(json.learning?.status === 'promoted'
        ? 'Evaluation recorded and verified learning promoted.'
        : 'Evaluation recorded. No verified business outcome is linked yet.')
      setGroundedness('')
      setToolAccuracy('')
      setFeedback('')
      await load()
    }
    setBusy(false)
  }

  const avg = (key: 'groundedness_score' | 'tool_accuracy_score') => {
    const values = evaluations.map((e) => e[key]).filter((v): v is number => typeof v === 'number')
    return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null
  }

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BrainCircuit size={20} />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Agent Learning & Evaluation</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Evaluate runs and promote durable learning only when evidence supports it.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[280px_1fr_1fr]">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Agent</span>
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="mt-2 h-10 w-full rounded-lg border bg-background px-3 text-sm">
            {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
          </select>
        </label>
        <div className="hidden md:block" />
        <div className="hidden md:block" />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border p-4">
          <Gauge size={16} />
          <p className="mt-2 text-xs text-muted-foreground">Avg groundedness</p>
          <p className="text-xl font-semibold">{avg('groundedness_score') ?? '—'}</p>
        </div>
        <div className="rounded-xl border p-4">
          <Gauge size={16} />
          <p className="mt-2 text-xs text-muted-foreground">Avg tool accuracy</p>
          <p className="text-xl font-semibold">{avg('tool_accuracy_score') ?? '—'}</p>
        </div>
        <div className="rounded-xl border p-4">
          <CheckCircle2 size={16} />
          <p className="mt-2 text-xs text-muted-foreground">Outcome-linked evaluations</p>
          <p className="text-xl font-semibold">{evaluations.filter((e) => e.outcome_linked).length}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_140px_140px]">
        <select value={selectedRun} onChange={(e) => setSelectedRun(e.target.value)} className="h-10 rounded-lg border bg-background px-3 text-sm">
          <option value="">Select a completed run…</option>
          {runs.filter((r) => r.status === 'completed').map((run) => (
            <option key={run.id} value={run.id}>{run.task.slice(0, 90)}</option>
          ))}
        </select>
        <input value={groundedness} onChange={(e) => setGroundedness(e.target.value)} inputMode="numeric" placeholder="Groundedness 0–100" className="h-10 rounded-lg border bg-background px-3 text-sm" />
        <input value={toolAccuracy} onChange={(e) => setToolAccuracy(e.target.value)} inputMode="numeric" placeholder="Tool accuracy 0–100" className="h-10 rounded-lg border bg-background px-3 text-sm" />
      </div>
      <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Optional reviewer feedback…" className="mt-3 min-h-20 w-full rounded-lg border bg-background p-3 text-sm" />
      <button type="button" onClick={() => void evaluate()} disabled={!selectedRun || busy} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
        {busy ? 'Saving…' : 'Evaluate run'}
      </button>
      {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}

      {evaluations.length > 0 && (
        <div className="mt-5 space-y-2">
          {evaluations.slice(0, 8).map((evaluation) => (
            <div key={evaluation.id} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
              <span className="truncate">{evaluation.run_id}</span>
              <span className="shrink-0 text-muted-foreground">
                {evaluation.outcome_linked ? 'Verified outcome linked' : 'No verified outcome'}
              </span>
            </div>
          ))}
        </div>
      )}

      {runs.length === 0 && (
        <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
          <CircleAlert size={16} /> Run an agent before evaluating its behavior.
        </div>
      )}
    </section>
  )
}
