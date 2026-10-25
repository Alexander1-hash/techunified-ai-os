'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, CheckCircle2, Clock3, RefreshCw, ShieldCheck, Target, Workflow } from 'lucide-react'

type EvaluationOutcome = {
  id: string
  title: string
  outcomeType: string
  evidenceStatus: string
  source: string | null
  periodStart: string | null
  periodEnd: string | null
  unit: string | null
  baseline: number | null
  current: number | null
  change: number | null
  percentageChange: number | null
  directionIsDescriptiveOnly: boolean
}

type Evaluation = {
  actionRunId: string
  actionStatus: string
  decisionId: string | null
  createdAt: string | null
  outcomeCount: number
  evidenceState: string
  evidenceStatuses: string[]
  outcomes: EvaluationOutcome[]
}

type Summary = {
  actionRunsReviewed: number
  completedRuns: number
  completedRunsWithOutcome: number
  completedRunsAwaitingOutcome: number
  completedRunsWithMeasuredEvidence: number
  completedRunsWithAttributedEvidence: number
  completedRunsWithComparableValues: number
  outcomeCoveragePercent: number | null
}

type ApiResponse = {
  limits: { actionRuns: number; outcomes: number }
  summary: Summary
  evaluations: Evaluation[]
  generatedAt: string
  guardrails: Record<string, boolean | number>
}

const evidenceLabels: Record<string, string> = {
  measured: 'Measured evidence',
  attributed: 'Attributed evidence',
  estimated: 'Estimate only',
  unknown: 'Review evidence status',
  awaiting_outcome: 'Outcome not recorded',
}

function shortId(value: string) {
  return value.length > 16 ? value.slice(0, 8) + '…' + value.slice(-5) : value
}

function formatDate(value: string | null) {
  if (!value) return 'Date not recorded'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date not recorded' : date.toLocaleDateString()
}

function formatChange(value: number | null, unit: string | null) {
  if (value === null) return 'No baseline comparison'
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value) + (unit ? ' ' + unit : '')
}

export default function DecisionEvaluationPage() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/business/decision-evaluation', { cache: 'no-store' })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Unable to load evaluation evidence.')
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load evaluation evidence.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const evaluations = useMemo(() => {
    const rows = data?.evaluations ?? []
    if (filter === 'all') return rows
    if (filter === 'awaiting_outcome') return rows.filter((row) => row.actionStatus === 'completed' && row.outcomeCount === 0)
    if (filter === 'with_evidence') return rows.filter((row) => row.outcomeCount > 0)
    if (filter === 'measured') return rows.filter((row) => row.evidenceState === 'measured')
    return rows.filter((row) => row.actionStatus === filter)
  }, [data, filter])

  const summary = data?.summary

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">Phase 13 · Evidence loop</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Decision Evaluation Center</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Review completed business action runs against the outcomes explicitly linked to them. Find missing follow-up evidence, inspect before-and-after values, and separate recorded measurements from estimates.
            </p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh evidence
          </button>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5"><ShieldCheck size={13} /> Organization-scoped</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5"><Workflow size={13} /> Recorded action-run links only</span>
          <Link href="/business-outcomes" className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 font-medium text-primary-foreground">Record / review outcomes <ArrowRight size={13} /></Link>
        </div>
      </section>

      {error ? <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Completed action runs', value: summary?.completedRuns ?? '—', icon: Workflow },
          { label: 'Runs linked to outcomes', value: summary?.completedRunsWithOutcome ?? '—', icon: CheckCircle2 },
          { label: 'Awaiting outcome evidence', value: summary?.completedRunsAwaitingOutcome ?? '—', icon: Clock3 },
          { label: 'Outcome coverage', value: summary?.outcomeCoveragePercent == null ? '—' : summary.outcomeCoveragePercent + '%', icon: Target },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><item.icon size={15} /> {item.label}</div>
            <p className="mt-3 text-2xl font-semibold">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-base font-semibold">Action-run evaluations</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Up to {data?.limits?.actionRuns ?? 100} action runs and {data?.limits?.outcomes ?? 500} outcomes are checked.</p></div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Filter
            <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
              <option value="all">All runs</option>
              <option value="awaiting_outcome">Awaiting outcome</option>
              <option value="with_evidence">Has linked outcome</option>
              <option value="measured">Measured evidence</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </label>
        </div>

        {loading && !data ? <div className="py-12 text-center text-sm text-muted-foreground">Loading evaluation evidence…</div> : null}
        {!loading && evaluations.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center"><BarChart3 className="mx-auto text-muted-foreground" size={24} /><p className="mt-3 text-sm font-medium">No runs match this filter</p><p className="mt-1 text-xs text-muted-foreground">Try another filter or record outcomes after completed business actions.</p></div> : null}

        <div className="mt-4 space-y-3">
          {evaluations.map((row) => (
            <article key={row.actionRunId} className="rounded-xl border border-border/80 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">Action run {shortId(row.actionRunId)}</h3>
                    <span className="rounded-full border border-border px-2 py-1 text-[10px] font-medium uppercase tracking-wide">{row.actionStatus}</span>
                    <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-medium">{evidenceLabels[row.evidenceState] ?? row.evidenceState}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Recorded {formatDate(row.createdAt)} · Decision reference: {row.decisionId ? shortId(row.decisionId) : 'Not linked'}</p>
                </div>
                <Link href="/business-outcomes" className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline">Review outcomes <ArrowRight size={13} /></Link>
              </div>
              {row.outcomes.length ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {row.outcomes.map((outcome) => (
                    <div key={outcome.id} className="rounded-lg bg-muted/40 p-3">
                      <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{outcome.title}</p><span className="rounded-full border border-border px-2 py-0.5 text-[10px]">{evidenceLabels[outcome.evidenceStatus] ?? outcome.evidenceStatus}</span></div>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Baseline</p><p className="mt-1 text-sm font-medium">{outcome.baseline === null ? 'Not recorded' : formatChange(outcome.baseline, outcome.unit)}</p></div>
                        <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Current</p><p className="mt-1 text-sm font-medium">{outcome.current === null ? 'Not recorded' : formatChange(outcome.current, outcome.unit)}</p></div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border/70 pt-3 text-xs">
                        <span className="text-muted-foreground">Change: <strong className="text-foreground">{formatChange(outcome.change, outcome.unit)}</strong></span>
                        {outcome.percentageChange !== null ? <span className="inline-flex items-center gap-1 text-muted-foreground">{outcome.percentageChange > 0 ? <ArrowUpRight size={13} /> : outcome.percentageChange < 0 ? <ArrowDownRight size={13} /> : null}{outcome.percentageChange.toFixed(1)}%</span> : null}
                      </div>
                      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">Source: {outcome.source || 'Not recorded'} · Period: {formatDate(outcome.periodStart)} – {formatDate(outcome.periodEnd)}</p>
                      <p className="mt-2 text-[10px] leading-4 text-muted-foreground">Numeric direction is descriptive only. It does not prove benefit, causation, or independently verified ROI.</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                  {row.actionStatus === 'completed' ? 'No outcome is linked to this completed action run yet. Record a follow-up outcome and link it to this run.' : 'No linked outcome is recorded for this run.'}
                </div>
              )}
            </article>
          ))}
        </div>
        {data?.generatedAt ? <p className="mt-4 text-[10px] text-muted-foreground">Evidence snapshot generated {new Date(data.generatedAt).toLocaleString()}.</p> : null}
      </section>

      <section className="rounded-xl border border-border bg-muted/20 p-4 text-xs leading-5 text-muted-foreground">
        <p className="font-semibold text-foreground">Interpretation guardrails</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>A completed workflow means the action run completed; it does not mean the business objective succeeded.</li>
          <li>Only explicit action-run links are used. Similar titles or timing are not treated as proof of attribution.</li>
          <li>Baseline-to-current changes are descriptive; they do not establish that TechUnifedAIOS caused the change.</li>
          <li>The page reads existing organization-scoped records and does not write or upgrade evidence statuses.</li>
        </ul>
      </section>
    </div>
  )
}
