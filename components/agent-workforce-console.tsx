'use client'

import { useState } from 'react'

type Agent = {
  id: string
  name: string
  purpose: string | null
  status: string | null
  autonomy_level: number | null
}

export default function AgentWorkforceConsole({ agents }: { agents: Agent[] }) {
  const [selected, setSelected] = useState(agents[0]?.id ?? '')
  const [task, setTask] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run() {
    if (!selected || !task.trim() || busy) return
    setBusy(true)
    setResult(null)
    try {
      const response = await fetch('/api/agents/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: selected, task: task.trim() }),
      })
      const json = await response.json()
      setResult(json.error ?? json.result ?? 'Agent completed.')
    } catch {
      setResult('Unable to run the agent right now.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-8 rounded-xl border bg-card p-5">
      <div>
        <p className="text-sm font-semibold">AI Workforce Console</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Give an active agent a task. The worker records its run, context and approval state before returning a result.
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[260px_1fr_auto] md:items-end">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Agent</span>
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            className="mt-2 h-10 w-full rounded-lg border bg-background px-3 text-sm"
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Task</span>
          <input
            value={task}
            onChange={(event) => setTask(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) run()
            }}
            placeholder="Example: Analyze the latest business outcomes and identify the next operational priority."
            className="mt-2 h-10 w-full rounded-lg border bg-background px-3 text-sm"
          />
        </label>

        <button
          type="button"
          onClick={run}
          disabled={!selected || !task.trim() || busy}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Running…' : 'Run agent'}
        </button>
      </div>

      {result && (
        <div className="mt-5 rounded-lg border bg-muted/30 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Worker result</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{result}</p>
        </div>
      )}
    </section>
  )
}
