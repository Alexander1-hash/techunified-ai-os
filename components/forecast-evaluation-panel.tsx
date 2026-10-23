"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, RefreshCw, Target } from "lucide-react"
import { Card } from "@/components/ui"

type Evaluation = {
  id: string
  objective_id: string
  objective_title: string
  predicted_progress: number | string
  observed_progress: number | string
  absolute_error: number | string
  accuracy_score: number | string
  prediction_confidence: "low" | "medium" | "high" | string
  evaluated_at: string
}

type Payload = {
  ok?: boolean
  summary?: {
    evaluationCount?: number
    objectivesEvaluated?: number
    averageAccuracyScore?: number | null
    averageAbsoluteError?: number | null
    latestEvaluationAt?: string | null
  }
  evaluations?: Evaluation[]
  methodology?: { limitations?: string }
  error?: string
}

function metric(value: number | null | undefined, suffix = "") {
  return value == null || !Number.isFinite(Number(value)) ? "—" : `${Number(value).toFixed(1)}${suffix}`
}

export default function ForecastEvaluationPanel() {
  const [payload, setPayload] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const refresh = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/business/forecast/evaluations", { cache: "no-store" })
      const body = await response.json().catch(() => ({})) as Payload
      if (!response.ok) throw new Error(body.error || `Forecast evaluation request failed (HTTP ${response.status}).`)
      setPayload(body)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load forecast evaluation history.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const summary = payload?.summary ?? {}
  const evaluations = Array.isArray(payload?.evaluations) ? payload.evaluations : []

  return (
    <section className="mx-auto max-w-7xl space-y-4 px-4 pb-8 sm:px-6 lg:px-8">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><Target size={18} /><h2 className="text-base font-semibold">Forecast evaluation & learning</h2></div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Compare previously recorded objective-progress predictions with later observed values. Scores describe the recorded evaluation window only.</p>
          </div>
          <button onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh history
          </button>
        </div>

        {error && <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-destructive" /><div><p className="font-medium">Evaluation history unavailable</p><p className="mt-1 text-muted-foreground">{error}</p><button onClick={() => void refresh()} className="mt-2 underline underline-offset-4">Retry</button></div></div>}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Evaluation records", loading ? "…" : String(summary.evaluationCount ?? 0)],
            ["Objectives evaluated", loading ? "…" : String(summary.objectivesEvaluated ?? 0)],
            ["Average accuracy score", loading ? "…" : metric(summary.averageAccuracyScore, "%")],
            ["Average absolute error", loading ? "…" : metric(summary.averageAbsoluteError, " pp")],
          ].map(([title, value]) => <div key={title} className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">{title}</p><p className="mt-2 text-xl font-semibold">{value}</p></div>)}
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold">Recent evaluation records</h3>
        {loading && <p className="mt-3 text-sm text-muted-foreground">Loading evaluation history…</p>}
        {!loading && !error && evaluations.length === 0 && (
          <div className="mt-3 rounded-lg border border-dashed border-border p-4">
            <p className="text-sm font-medium">No forecast evaluations recorded yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Evaluations are recorded when Company Intelligence has a prior snapshot and subsequent objective values that can be compared. Refresh Company Intelligence after new objective measurements are available to continue the loop.</p>
          </div>
        )}
        {evaluations.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="px-3 py-2 font-medium">Objective</th><th className="px-3 py-2 font-medium">Predicted</th><th className="px-3 py-2 font-medium">Observed</th><th className="px-3 py-2 font-medium">Absolute error</th><th className="px-3 py-2 font-medium">Accuracy</th><th className="px-3 py-2 font-medium">Evaluated</th></tr></thead>
              <tbody>{evaluations.map((row) => (
                <tr key={row.id} className="border-b border-border/70 last:border-0">
                  <td className="px-3 py-3"><p className="font-medium">{row.objective_title}</p><p className="mt-1 text-xs text-muted-foreground">Confidence: {row.prediction_confidence}</p></td>
                  <td className="px-3 py-3">{metric(Number(row.predicted_progress), "%")}</td>
                  <td className="px-3 py-3">{metric(Number(row.observed_progress), "%")}</td>
                  <td className="px-3 py-3">{metric(Number(row.absolute_error), " pp")}</td>
                  <td className="px-3 py-3">{metric(Number(row.accuracy_score), "%")}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{Number.isFinite(Date.parse(row.evaluated_at)) ? new Date(row.evaluated_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <p className="mt-4 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">{payload?.methodology?.limitations ?? "Evaluation scores are descriptive and are not proof of causation or financial impact."}</p>
      </Card>
    </section>
  )
}
