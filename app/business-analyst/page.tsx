'use client'

import { useEffect, useState } from 'react'
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Brain,
  Lightbulb,
  AlertTriangle,
} from 'lucide-react'
import { BusinessAnalystWorkspace } from '@/components/business-analyst-workspace'

export default function AnalystPage() {
  const [core, setCore] = useState<any>(null)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/business/intelligence')
      .then((response) => response.ok ? response.json() : null)
      .then((json) => setCore(json?.snapshot?.intelligence?.intelligenceCore ?? json?.intelligenceCore ?? null))
      .catch(() => setCore(null))
  }, [])

  async function syncSalesIntelligence() {
    try {
      setSyncing(true)
      setMessage('')
      setError('')

      const response = await fetch(
        '/api/business/sales-intelligence',
        {
          method: 'POST',
        },
      )

      const json = await response.json()

      if (!response.ok) {
        throw new Error(
          json.detail ||
            json.error ||
            'Unable to synchronize sales intelligence.',
        )
      }

      setMessage(
        'Operational intelligence synchronized successfully. Business KPIs have been updated.',
      )

      window.setTimeout(() => {
        window.location.reload()
      }, 900)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to synchronize sales intelligence.',
      )
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/70 bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">
              Intelligence Sync
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Connect Customers, Services, Departments, and Sales activity to verified Business KPIs.
            </p>
          </div>

          <button
            type="button"
            onClick={syncSalesIntelligence}
            disabled={syncing}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {syncing ? (
              <Loader2
                size={16}
                className="animate-spin"
              />
            ) : (
              <RefreshCw size={16} />
            )}

            {syncing
              ? 'Synchronizing…'
              : 'Sync Operations Intelligence'}
          </button>
        </div>

        {(message || error) && (
          <div className="mx-auto max-w-7xl px-5 pb-4">
            {message ? (
              <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                <CheckCircle2
                  size={16}
                  className="mt-0.5 shrink-0"
                />

                <span>{message}</span>
              </div>
            ) : null}

            {error ? (
              <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                <AlertCircle
                  size={16}
                  className="mt-0.5 shrink-0"
                />

                <span>{error}</span>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {core ? (
        <section className="mx-auto max-w-7xl px-5 py-5">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary"><Brain size={19} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">Intelligence Core</p>
                <h2 className="mt-1 text-lg font-semibold">Adaptive business reasoning</h2>
                <p className="mt-1 text-sm text-muted-foreground">Evidence-bounded observations, hypotheses, scenarios, decisions, governance, and learning.</p>
              </div>
              <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">{core.version ?? 'adaptive-core'}</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Observed signals</p><p className="mt-1 text-xl font-semibold">{core.observations?.length ?? 0}</p></div>
              <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Working hypotheses</p><p className="mt-1 text-xl font-semibold">{core.hypotheses?.length ?? 0}</p></div>
              <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Decision options</p><p className="mt-1 text-xl font-semibold">{core.decisions?.length ?? 0}</p></div>
            </div>
            {(core.decisions?.length || core.contradictions?.length) ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2 text-sm font-medium"><Lightbulb size={16} /> Next decisions</div>
                  <div className="mt-2 space-y-2">{(core.decisions ?? []).slice(0, 3).map((item: any) => <div key={item.action} className="text-sm"><span className="font-medium">{item.action.replaceAll('_', ' ')}</span><p className="text-xs text-muted-foreground">{item.rationale}</p></div>)}</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2 text-sm font-medium"><AlertTriangle size={16} /> Contradictions</div>
                  <div className="mt-2 space-y-2">{(core.contradictions ?? []).slice(0, 3).map((item: any) => <div key={item.type} className="text-sm"><span className="font-medium">{item.type.replaceAll('_', ' ')}</span><p className="text-xs text-muted-foreground">{item.description}</p></div>)}</div>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <BusinessAnalystWorkspace />
    </div>
  )
}
