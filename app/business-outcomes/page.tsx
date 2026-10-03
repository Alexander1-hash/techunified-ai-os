'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart3, CheckCircle2, Clock3, DollarSign, Plus, Target, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type OutcomeSummary = {
  count: number
  currencies: string[]
  currency: string | null
  costAvoided: number
  revenueImpact: number
  implementationCost: number
  hoursSaved: number
  netImpact: number | null
  roi: number | null
}

type Outcome = {
  id: string
  title: string
  outcome_type: string
  baseline_value: number | null
  current_value: number | null
  unit: string | null
  hours_saved: number
  cost_avoided: number
  revenue_impact: number
  implementation_cost: number
  currency: string
  evidence_status: string
  source: string | null
  period_start: string | null
  period_end: string | null
}

const emptyForm = {
  title: '',
  outcome_type: 'cost_saving',
  baseline_value: '',
  current_value: '',
  unit: '',
  hours_saved: '',
  cost_avoided: '',
  revenue_impact: '',
  implementation_cost: '',
  currency: 'NGN',
  evidence_status: 'estimated',
  source: '',
  period_start: '',
  period_end: '',
}

function n(value: string | number | null | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export default function BusinessOutcomesPage() {
  const [outcomes, setOutcomes] = useState<Outcome[]>([])
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [verifiedSummary, setVerifiedSummary] = useState<OutcomeSummary | null>(null)
  const [estimatedSummary, setEstimatedSummary] = useState<OutcomeSummary | null>(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/business/outcomes', { cache: 'no-store' })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Unable to load outcomes.')
      setOutcomes(json.outcomes ?? [])
      const summaryResponse = await fetch('/api/business/outcomes/summary', { cache: 'no-store' })
      const summaryJson = await summaryResponse.json()
      if (summaryResponse.ok) {
        setVerifiedSummary(summaryJson.evidence?.verified ?? null)
        setEstimatedSummary(summaryJson.evidence?.estimated ?? null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load outcomes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')

    try {
      const response = await fetch('/api/business/outcomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          baseline_value: form.baseline_value ? n(form.baseline_value) : null,
          current_value: form.current_value ? n(form.current_value) : null,
          hours_saved: n(form.hours_saved),
          cost_avoided: n(form.cost_avoided),
          revenue_impact: n(form.revenue_impact),
          implementation_cost: n(form.implementation_cost),
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Unable to record outcome.')
      setForm(emptyForm)
      setMessage('Business outcome recorded. Evidence remains labelled by its evidence status.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record outcome.')
    } finally {
      setSaving(false)
    }
  }

  const summary = useMemo(() => {
    const fallback = {
      value: 0,
      implementation: 0,
      hours: 0,
      net: 0,
      currency: 'NGN',
    }
    if (!verifiedSummary) return fallback
    return {
      value: verifiedSummary.costAvoided + verifiedSummary.revenueImpact,
      implementation: verifiedSummary.implementationCost,
      hours: verifiedSummary.hoursSaved,
      net: verifiedSummary.netImpact ?? 0,
      currency: verifiedSummary.currency || 'NGN',
    }
  }, [verifiedSummary])

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">Commercial evidence</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Business Outcomes & ROI</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Record measurable outcomes from TechUnified so future pilots and customers can demonstrate time saved, cost avoided, revenue impact, and efficiency gains using evidence rather than claims.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background px-4 py-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Evidence first.</span> Estimated values are never presented as verified results.
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {([
          { label: 'Verified value', value: money(summary.value, summary.currency), icon: DollarSign },
          { label: 'Verified hours saved', value: summary.hours.toLocaleString(), icon: Clock3 },
          { label: 'Verified implementation cost', value: money(summary.implementation, summary.currency), icon: Target },
          { label: 'Verified net impact', value: money(summary.net, summary.currency), icon: TrendingUp },
        ] as { label: string; value: string; icon: LucideIcon }[]).map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon size={15} /> {label}</div>
            <div className="mt-3 text-xl font-semibold">{value}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2"><Plus size={17} /><h2 className="text-base font-semibold">Record an outcome</h2></div>
          <p className="mt-1 text-xs text-muted-foreground">Use customer/pilot evidence when available. Mark estimates honestly.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {[
              ['title','Outcome title','text'],
              ['baseline_value','Baseline value','number'],
              ['current_value','Current value','number'],
              ['unit','Unit','text'],
              ['hours_saved','Hours saved','number'],
              ['cost_avoided','Cost avoided','number'],
              ['revenue_impact','Revenue impact','number'],
              ['implementation_cost','Implementation cost','number'],
              ['currency','Currency','text'],
              ['source','Evidence source','text'],
              ['period_start','Period start','date'],
              ['period_end','Period end','date'],
            ].map(([key, label, type]) => (
              <label key={key} className="space-y-1.5">
                <span className="text-xs font-medium">{label}</span>
                <input
                  required={key === 'title'}
                  type={type}
                  value={form[key as keyof typeof form]}
                  onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
              </label>
            ))}
            <label className="space-y-1.5">
              <span className="text-xs font-medium">Outcome type</span>
              <select value={form.outcome_type} onChange={(event) => setForm((current) => ({ ...current, outcome_type: event.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
                <option value="cost_saving">Cost saving</option>
                <option value="productivity">Productivity</option>
                <option value="revenue_opportunity">Revenue opportunity</option>
                <option value="efficiency">Efficiency</option>
                <option value="error_reduction">Error reduction</option>
                <option value="risk_reduction">Risk reduction</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium">Evidence status</span>
              <select value={form.evidence_status} onChange={(event) => setForm((current) => ({ ...current, evidence_status: event.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
                <option value="estimated">Estimated</option>
                <option value="measured">Measured</option>
                <option value="attributed">Attributed</option>
              </select>
            </label>
          </div>
          <button disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
            {saving ? 'Saving…' : 'Record outcome'}
          </button>
          {(message || error) && <p className="mt-3 text-xs text-muted-foreground">{message || error}</p>}
        </form>

        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2"><BarChart3 size={17} /><h2 className="text-base font-semibold">Evidence model</h2></div>
          <div className="mt-4 space-y-3 text-sm">
            {[
              ['Measured', 'Directly supported by observed customer or operational data.'],
              ['Attributed', 'Linked to a TechUnified intervention with a documented basis.'],
              ['Estimated', 'A planning or model estimate; not a verified business result.'],
            ].map(([name, description]) => (
              <div key={name} className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 size={14} /> {name}</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-border bg-background p-4 text-xs leading-5 text-muted-foreground">
            <div className="flex items-center justify-between gap-4"><span>Verified evidence</span><span className="font-medium text-foreground">{verifiedSummary?.count ?? 0} outcomes</span></div>
            <div className="mt-1 flex items-center justify-between gap-4"><span>Planning estimates</span><span className="font-medium text-foreground">{estimatedSummary?.count ?? 0} outcomes</span></div>
            <div className="mt-2">Verified totals include measured and attributed outcomes only. Estimates remain separate and are never included in verified value or ROI.</div>
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            This foundation intentionally does not manufacture ROI. It creates a durable evidence trail that can later feed reports, grants, investor materials, customer success reviews, and enterprise ROI analysis.
          </p>
        </section>
      </section>

      <section className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border p-5"><h2 className="text-base font-semibold">Recorded outcomes</h2></div>
        {loading ? <div className="p-5 text-sm text-muted-foreground">Loading outcomes…</div> : outcomes.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">No outcomes recorded yet. That is expected while TechUnified is in early validation.</div> : (
          <div className="divide-y divide-border">
            {outcomes.map((outcome) => (
              <div key={outcome.id} className="grid gap-3 p-5 md:grid-cols-[1.4fr_.7fr_.7fr_.7fr] md:items-center">
                <div><div className="text-sm font-medium">{outcome.title}</div><div className="mt-1 text-xs text-muted-foreground">{outcome.source || 'Source not specified'}</div></div>
                <div><div className="text-[11px] text-muted-foreground">Evidence</div><div className="text-sm capitalize">{outcome.evidence_status}</div></div>
                <div><div className="text-[11px] text-muted-foreground">Hours</div><div className="text-sm">{n(outcome.hours_saved).toLocaleString()}</div></div>
                <div><div className="text-[11px] text-muted-foreground">Value</div><div className="text-sm">{money(n(outcome.cost_avoided) + n(outcome.revenue_impact), outcome.currency || 'NGN')}</div></div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
