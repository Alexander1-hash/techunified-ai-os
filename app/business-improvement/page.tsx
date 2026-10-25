'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, RefreshCw, ShieldCheck, Sparkles, Target } from 'lucide-react'

type Priority = 'high' | 'medium' | 'review'
type Item = {
  id: string
  title: string
  category: string
  priority: Priority
  reason: string
  nextStep: string
  href: string
}
type ResponseData = {
  generatedAt: string
  limits: { actionRunsReviewed: number; outcomesReviewed: number }
  summary: { totalPriorities: number; high: number; medium: number; review: number; completedRunsReviewed: number; outcomesReviewed: number }
  priorities: Item[]
  guardrails: Record<string, boolean | number>
}

const priorityLabel: Record<Priority, string> = {
  high: 'High priority',
  medium: 'Medium priority',
  review: 'Evidence review',
}

function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString()
}

export default function BusinessImprovementPage() {
  const [data, setData] = useState<ResponseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/business/improvement-priorities', { cache: 'no-store' })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Unable to load improvement priorities.')
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load improvement priorities.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const items = useMemo(() => {
    const rows = data?.priorities ?? []
    return filter === 'all' ? rows : rows.filter((item) => item.priority === filter)
  }, [data, filter])

  const summary = data?.summary

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">Phase 14 · Evidence-led operations</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Business Improvement Engine</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Turn recorded evidence gaps into a prioritized worklist. The engine identifies missing follow-up, sources, measurement periods, comparisons and evidence reviews—then links you to the place where you can correct the record.
            </p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh priorities
          </button>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5"><ShieldCheck size={13} /> Organization-scoped</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5"><Sparkles size={13} /> Evidence-driven, not invented</span>
          <Link href="/decision-evaluation" className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 font-medium text-primary-foreground">Decision Evaluation <ArrowRight size={13} /></Link>
        </div>
      </section>

      {error ? <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Open priorities', value: summary?.totalPriorities ?? '—', icon: Target },
          { label: 'High priority', value: summary?.high ?? '—', icon: AlertTriangle },
          { label: 'Measurement fixes', value: summary?.medium ?? '—', icon: Clock3 },
          { label: 'Evidence reviews', value: summary?.review ?? '—', icon: CheckCircle2 },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><item.icon size={15} /> {item.label}</div>
            <p className="mt-3 text-2xl font-semibold">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Recommended next steps</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Generated from up to {data?.limits.actionRunsReviewed ?? 100} action runs and {data?.limits.outcomesReviewed ?? 500} outcomes. Older records may fall outside this review window.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Filter
            <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
              <option value="all">All priorities</option>
              <option value="high">High priority</option>
              <option value="medium">Medium priority</option>
              <option value="review">Evidence review</option>
            </select>
          </label>
        </div>

        {loading && !data ? <div className="py-12 text-center text-sm text-muted-foreground">Reviewing recorded evidence…</div> : null}
        {!loading && !error && items.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center">
            <CheckCircle2 className="mx-auto text-muted-foreground" size={26} />
            <p className="mt-3 text-sm font-medium">No priorities found in this review window</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">This is not proof that the business has no problems. It means these specific evidence gaps were not found in the records reviewed.</p>
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-xl border border-border/80 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                    <span className="rounded-full border border-border px-2 py-1 text-[10px] font-medium uppercase tracking-wide">{priorityLabel[item.priority]}</span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">{item.category}</p>
                </div>
                <Link href={item.href} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline">Review record <ArrowRight size={13} /></Link>
              </div>
              <p className="mt-3 text-sm leading-5">{item.reason}</p>
              <div className="mt-3 rounded-lg bg-muted/40 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Suggested next step</p>
                <p className="mt-1 text-xs leading-5">{item.nextStep}</p>
              </div>
            </article>
          ))}
        </div>
        {data?.generatedAt ? <p className="mt-4 text-[10px] text-muted-foreground">Evidence review generated {dateLabel(data.generatedAt)}.</p> : null}
      </section>

      <section className="rounded-xl border border-border bg-muted/20 p-4 text-xs leading-5 text-muted-foreground">
        <p className="font-semibold text-foreground">Important guardrails</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Recommendations are generated from recorded fields and explicit action-run links, not inferred causality.</li>
          <li>The engine is read-only. It does not alter outcome records, change evidence classifications or execute business actions.</li>
          <li>Estimated outcomes remain estimates until supporting evidence justifies another classification.</li>
          <li>Only the latest limited record window is reviewed; check the underlying pages for broader history.</li>
        </ul>
      </section>
    </div>
  )
}
