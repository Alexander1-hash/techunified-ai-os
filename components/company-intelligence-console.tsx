'use client'

import { useEffect, useState } from 'react'
import { BrainCircuit, RefreshCw, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui'

type Intelligence = {
  snapshot?: { state?: Record<string, any>; confidence?: string; computed_at?: string }
  signals?: Array<{ type: string; severity: string; title: string; reason: string }>
  forecasts?: Array<{ objectiveId: string; progressPercent: number; remaining: number; direction: string; trajectory: string; confidence: string }>
  objectiveIntelligence?: Array<{ objectiveId: string; pressure: string; completedRuns: number; failedRuns: number; pendingApprovals: number }>
  governance?: { requiresHumanOversight: boolean; highSeveritySignals: number; forecastConfidence: string; evidenceBound: boolean }
  longitudinal?: { changed: boolean; changedFields: string[]; recentStateAvailable: boolean }
  graph?: { activeEdges: number; objectiveRelationships: number }
  forecastEvaluation?: { evaluated: number; averageAccuracy: number | null }
  error?: string
}

export default function CompanyIntelligenceConsole() {
  const [data, setData] = useState<Intelligence | null>(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    try {
      const response = await fetch('/api/business/intelligence', { cache: 'no-store' })
      const json = await response.json()
      setData(json)
    } catch {
      setData({ error: 'Unable to load company intelligence.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  if (loading && !data) {
    return <Card><div className="flex items-center gap-3 p-2 text-sm text-muted-foreground"><RefreshCw className="size-4 animate-spin" /> Computing company intelligence…</div></Card>
  }

  if (data?.error) {
    return <Card><div className="flex items-center justify-between gap-3"><p className="text-sm text-destructive">{data.error}</p><button onClick={() => void refresh()} className="rounded-lg border px-3 py-2 text-xs">Retry</button></div></Card>
  }

  const state = data?.snapshot?.state ?? {}
  const signals = data?.signals ?? []
  const forecasts = data?.forecasts ?? []
  const governance = data?.governance
  const longitudinal = data?.longitudinal
  const graph = data?.graph

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><BrainCircuit className="size-5" /><h2 className="text-lg font-semibold">Adaptive company intelligence</h2></div>
          <p className="mt-1 text-sm text-muted-foreground">Evidence-bound company state, emerging signals, trajectory, governance and longitudinal change.</p>
        </div>
        <button onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium disabled:opacity-50">
          <RefreshCw className={loading ? 'size-3.5 animate-spin' : 'size-3.5'} /> Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Objectives', state.objectiveCount ?? 0],
          ['Active work', state.activeOrchestrationRuns ?? 0],
          ['Verified outcomes', state.verifiedOutcomes ?? 0],
          ['Pending approvals', state.pendingApprovals ?? 0],
        ].map(([label, value]) => <Card key={String(label)}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{String(value)}</p></Card>)}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Signals</p><p className="mt-1 text-sm">What needs attention now</p></div><span className="rounded-full border px-2 py-1 text-xs">{signals.length} detected</span></div>
          <div className="mt-4 space-y-2">
            {signals.length ? signals.map((signal, index) => <div key={signal.type + index} className="rounded-lg border p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{signal.title}</p><span className="rounded-full border px-2 py-0.5 text-[11px]">{signal.severity}</span></div><p className="mt-1 text-xs text-muted-foreground">{signal.reason}</p></div>) : <p className="text-sm text-muted-foreground">No material signals detected from the current evidence.</p>}
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2"><ShieldCheck className="size-4" /><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Governance & evidence</p></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><p className="text-xs text-muted-foreground">Human oversight</p><p className="mt-1 text-sm font-semibold">{governance?.requiresHumanOversight ? 'Required' : 'No high-risk gate detected'}</p></div>
            <div><p className="text-xs text-muted-foreground">Forecast confidence</p><p className="mt-1 text-sm font-semibold">{governance?.forecastConfidence ?? 'low'}</p></div>
            <div><p className="text-xs text-muted-foreground">Evidence bound</p><p className="mt-1 text-sm font-semibold">{governance?.evidenceBound ? 'Yes' : 'No'}</p></div>
            <div><p className="text-xs text-muted-foreground">Intelligence confidence</p><p className="mt-1 text-sm font-semibold">{data?.snapshot?.confidence ?? 'low'}</p></div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Objective trajectories</p><p className="mt-1 text-sm">Predictions remain explicitly confidence-bound.</p></div><span className="text-xs text-muted-foreground">{forecasts.length} forecast{forecasts.length === 1 ? '' : 's'}</span></div>
        <div className="mt-4 space-y-2">
          {forecasts.length ? forecasts.map((forecast) => <div key={forecast.objectiveId} className="rounded-lg border p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">Objective {forecast.objectiveId.slice(0, 8)}</p><p className="mt-1 text-xs text-muted-foreground">{forecast.trajectory.replace(/_/g, ' ')} · {forecast.confidence} confidence</p></div><div className="flex items-center gap-2">{forecast.direction === 'below_target' ? <TrendingDown className="size-4" /> : <TrendingUp className="size-4" />}<span className="text-sm font-semibold">{Math.round(forecast.progressPercent)}%</span></div></div></div>) : <p className="text-sm text-muted-foreground">Numeric objective targets are not available for forecasting yet.</p>}
        </div>
      </Card>

      <Card>
        <div className="grid gap-4 sm:grid-cols-4">
          <div><p className="text-xs text-muted-foreground">Forecasts evaluated</p><p className="mt-1 text-sm font-semibold">{data?.forecastEvaluation?.evaluated ?? 0}</p></div>
          <div><p className="text-xs text-muted-foreground">Average forecast accuracy</p><p className="mt-1 text-sm font-semibold">{data?.forecastEvaluation?.averageAccuracy != null ? data.forecastEvaluation.averageAccuracy + '%' : 'Not enough history'}</p></div>
          <div><p className="text-xs text-muted-foreground">State changed</p><p className="mt-1 text-sm font-semibold">{longitudinal?.changed ? 'Yes' : 'No material change'}</p><p className="mt-1 text-xs text-muted-foreground">{longitudinal?.changedFields?.join(', ') || 'No tracked fields changed.'}</p></div>
          <div><p className="text-xs text-muted-foreground">Intelligence graph edges</p><p className="mt-1 text-sm font-semibold">{graph?.activeEdges ?? 0}</p><p className="mt-1 text-xs text-muted-foreground">{graph?.objectiveRelationships ?? 0} objective relationships</p></div>
          <div><p className="text-xs text-muted-foreground">Latest computation</p><p className="mt-1 text-sm font-semibold">{data?.snapshot?.computed_at ? new Date(data.snapshot.computed_at).toLocaleString() : 'Not available'}</p></div>
        </div>
      </Card>
    </section>
  )
}
