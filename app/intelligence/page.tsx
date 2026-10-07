'use client'

import { useEffect, useState } from 'react'
import { Brain, RefreshCw, ShieldCheck, AlertTriangle, Lightbulb, GitBranch } from 'lucide-react'

type Core = {
  version?: string
  stages?: string[]
  understanding?: { companyStateConfidence?: string; signalConfidence?: string; evidenceBound?: boolean; verifiedOutcomeCount?: number; activeWorkCount?: number }
  hypotheses?: Array<{ statement: string; status: string; confidence: string; evidenceRequired: string }>
  contradictions?: Array<{ type: string; severity: string; description: string }>
  scenarios?: Array<{ name: string; assumption: string }>
  decisions?: Array<{ priority: string; action: string; rationale: string }>
  governance?: { humanOversightRequired?: boolean; autonomousExternalExecution?: boolean; causalClaimsAllowed?: boolean; roiClaimsAllowedWithoutPilotEvidence?: boolean }
}

export default function IntelligencePage() {
  const [core, setCore] = useState<Core | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    try {
      setLoading(true)
      setError('')
      const response = await fetch('/api/business/intelligence', { cache: 'no-store' })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Unable to load intelligence.')
      setCore(json.intelligenceCore ?? json.snapshot?.graph?.intelligenceCore ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load intelligence.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="min-h-screen bg-background p-6 text-sm text-muted-foreground">Loading Intelligence Core…</div>

  if (error) return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl rounded-xl border border-border bg-card p-5">
        <p className="font-medium">Intelligence Core unavailable</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <button onClick={load} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"><RefreshCw size={15} />Retry</button>
      </div>
    </div>
  )

  if (!core) return <div className="min-h-screen bg-background p-6 text-sm text-muted-foreground">No intelligence snapshot is available yet. Run the intelligence pipeline first.</div>

  const u = core.understanding ?? {}
  const g = core.governance ?? {}

  return (
    <main className="min-h-screen bg-background">
      <div className="border-b border-border/70 bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5">
          <div>
            <div className="flex items-center gap-2 text-primary"><Brain size={20} /><span className="text-xs font-semibold uppercase tracking-[.18em]">Intelligence Core</span></div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Adaptive Business Intelligence</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Observe company state, reason over evidence, test scenarios, recommend governed decisions, and learn from verified outcomes.</p>
          </div>
          <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-muted"><RefreshCw size={15} />Refresh</button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-5 p-5">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['State confidence', u.companyStateConfidence ?? 'unknown'],
            ['Signal confidence', u.signalConfidence ?? 'unknown'],
            ['Verified outcomes', String(u.verifiedOutcomeCount ?? 0)],
            ['Active work', String(u.activeWorkCount ?? 0)],
          ].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-card p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></div>)}
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2"><GitBranch size={18} /><h2 className="font-semibold">Reasoning pipeline</h2><span className="ml-auto text-xs text-muted-foreground">{core.version}</span></div>
          <div className="mt-4 flex flex-wrap gap-2">{(core.stages ?? []).map((stage, i) => <span key={stage} className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium">{i + 1}. {stage}</span>)}</div>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-5"><div className="flex items-center gap-2"><Lightbulb size={18} /><h2 className="font-semibold">Working hypotheses</h2></div><div className="mt-4 space-y-3">{(core.hypotheses ?? []).length ? core.hypotheses!.map((h, i) => <div key={i} className="rounded-lg border border-border p-3"><div className="flex gap-2 text-xs text-muted-foreground"><span>{h.status}</span><span>•</span><span>{h.confidence} confidence</span></div><p className="mt-1 text-sm">{h.statement}</p><p className="mt-2 text-xs text-muted-foreground">Evidence needed: {h.evidenceRequired}</p></div>) : <p className="text-sm text-muted-foreground">No working hypotheses yet.</p>}</div></section>

          <section className="rounded-xl border border-border bg-card p-5"><div className="flex items-center gap-2"><AlertTriangle size={18} /><h2 className="font-semibold">Contradictions & gaps</h2></div><div className="mt-4 space-y-3">{(core.contradictions ?? []).length ? core.contradictions!.map((c, i) => <div key={i} className="rounded-lg border border-border p-3"><p className="text-xs font-semibold uppercase tracking-wide">{c.type} · {c.severity}</p><p className="mt-1 text-sm text-muted-foreground">{c.description}</p></div>) : <p className="text-sm text-muted-foreground">No material contradictions detected.</p>}</div></section>
        </div>

        <section className="rounded-xl border border-border bg-card p-5"><h2 className="font-semibold">Decision options</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{(core.decisions ?? []).map((d, i) => <div key={i} className="rounded-lg border border-border p-4"><div className="flex justify-between gap-3"><span className="font-medium">{d.action.replaceAll('_', ' ')}</span><span className="text-xs uppercase text-muted-foreground">{d.priority}</span></div><p className="mt-2 text-sm text-muted-foreground">{d.rationale}</p></div>)}</div></section>

        <section className="rounded-xl border border-border bg-card p-5"><h2 className="font-semibold">Scenario simulation</h2><div className="mt-4 grid gap-3 md:grid-cols-3">{(core.scenarios ?? []).map(s => <div key={s.name} className="rounded-lg border border-border p-4"><p className="font-medium capitalize">{s.name.replaceAll('_', ' ')}</p><p className="mt-2 text-sm text-muted-foreground">{s.assumption}</p></div>)}</div></section>

        <section className="rounded-xl border border-border bg-card p-5"><div className="flex items-center gap-2"><ShieldCheck size={18} /><h2 className="font-semibold">Governance boundary</h2></div><div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">{[['Human oversight required', g.humanOversightRequired], ['Autonomous external execution', g.autonomousExternalExecution], ['Causal claims allowed', g.causalClaimsAllowed], ['ROI claims without pilot evidence', g.roiClaimsAllowedWithoutPilotEvidence]].map(([label, value]) => <div key={String(label)} className="flex justify-between rounded-lg bg-muted/40 px-3 py-2"><span>{label}</span><span className="font-medium">{value ? 'Yes' : 'No'}</span></div>)}</div></section>
      </div>
    </main>
  )
}
