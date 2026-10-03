'use client'

import { useEffect, useState } from 'react'
import { Check, Clock3, ShieldCheck, X } from 'lucide-react'

type Approval = {
  id: string
  agent_run_id: string
  status: string
  action_type: string
  title: string
  reason: string | null
  proposed_action: Record<string, unknown>
  decision_evidence: Record<string, unknown>
  requested_at: string
  reviewed_at: string | null
}

export default function AgentApprovalCenter() {
  const [items, setItems] = useState<Approval[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const response = await fetch('/api/agents/approvals', { cache: 'no-store' })
    const json = await response.json().catch(() => ({}))
    setItems(json.approvals ?? [])
    setLoading(false)
    if (!response.ok) setError(json.error ?? 'Unable to load approvals.')
  }

  useEffect(() => { void load() }, [])

  async function decide(id: string, decision: 'approved' | 'rejected') {
    setBusy(id)
    setError('')
    const response = await fetch('/api/agents/approvals/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvalId: id, decision }),
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) setError(json.error ?? 'Unable to update approval.')
    await load()
    setBusy(null)
  }

  const pending = items.filter((item) => item.status === 'pending')

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Agent Approval Center</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Review proposed AI actions before any controlled execution begins.
          </p>
        </div>
        <span className="rounded-full border border-border px-2.5 py-1 text-xs">
          {pending.length} pending
        </span>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="mt-5 text-sm text-muted-foreground">Loading approvals…</p>
      ) : pending.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-border p-6 text-center">
          <Clock3 className="mx-auto h-5 w-5 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No pending approvals</p>
          <p className="mt-1 text-xs text-muted-foreground">Approved and rejected requests remain recorded for auditability.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {pending.map((item) => (
            <article key={item.id} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.reason || 'No reason supplied.'}</p>
                </div>
                <span className="rounded-full bg-muted px-2 py-1 text-[11px] uppercase tracking-wide">
                  {item.action_type.replace('_', ' ')}
                </span>
              </div>
              <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-muted/50 p-3 text-xs">
                {JSON.stringify(item.proposed_action, null, 2)}
              </pre>
              <div className="mt-4 flex gap-2">
                <button
                  disabled={busy === item.id}
                  onClick={() => void decide(item.id, 'approved')}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  <Check className="h-4 w-4" /> Approve
                </button>
                <button
                  disabled={busy === item.id}
                  onClick={() => void decide(item.id, 'rejected')}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  <X className="h-4 w-4" /> Reject
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
