"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, RefreshCw, ShieldCheck } from "lucide-react"
import { Card } from "@/components/ui"

type Decision = {
  id: string
  priority: "critical" | "high" | "medium"
  title: string
  recommendation: string
  rationale: string
  evidence: string[]
  confidence: "high" | "medium" | "low"
  approvalRequired: boolean
  financialImpact: "not_estimated"
}

type Brief = {
  ok?: boolean
  generatedAt?: string
  summary?: {
    decisionCount?: number
    highestPriority?: string | null
    evidenceGrounding?: string
    executionSafety?: string
  }
  decisions?: Decision[]
  evidence?: {
    objectives?: number
    orchestrationRuns?: number
    completedActionRuns?: number
    measuredOrAttributedOutcomes?: number
    completedActionsNeedingMeasurement?: number
    pendingApprovals?: number
    failedOrchestrationRuns?: number
    kpiRecords?: number
    sourceRecords?: number
  }
  guardrails?: {
    organizationScoped?: boolean
    humanApprovalRequiredForGovernedExecution?: boolean
    autonomousExecutionPerformed?: boolean
    financialImpactEstimated?: boolean
    causalClaimsMade?: boolean
    note?: string
  }
}

function priorityClass(priority: string) {
  if (priority === "critical") return "border-destructive/30 bg-destructive/10 text-destructive"
  if (priority === "high") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  return "border-border bg-muted/50 text-muted-foreground"
}

export default function DecisionBriefPanel() {
  const [brief, setBrief] = useState<Brief | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/business/intelligence/decision-brief", { cache: "no-store" })
      const body = await response.json().catch(() => ({})) as Brief & { error?: string }
      if (!response.ok) throw new Error(body.error || `Decision brief request failed (HTTP ${response.status}).`)
      setBrief(body)
      setRefreshedAt(new Date().toISOString())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load evidence-ranked decisions.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const decisions = Array.isArray(brief?.decisions) ? brief.decisions : []
  const evidence = brief?.evidence ?? {}
  const guardrails = brief?.guardrails ?? {}

  return (
    <section className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><ClipboardList size={18} /><h2 className="text-base font-semibold">Evidence-ranked decision brief</h2></div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">The command center turns observed objectives, approvals, execution failures, business data, and verified outcomes into a ranked next-step queue.</p>
          </div>
          <button onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh decisions
          </button>
        </div>

        {error && <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-destructive" /><div><p className="font-medium">Decision brief unavailable</p><p className="mt-1 text-muted-foreground">{error}</p><button onClick={() => void refresh()} className="mt-2 underline underline-offset-4">Retry</button></div></div>}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Prioritized decisions", brief ? String(brief.summary?.decisionCount ?? decisions.length) : loading ? "…" : "—"],
            ["Pending approvals", evidence.pendingApprovals],
            ["Failed orchestration", evidence.failedOrchestrationRuns],
            ["Actions needing measurement", evidence.completedActionsNeedingMeasurement],
          ].map(([title, value]) => <div key={String(title)} className="rounded-lg border border-border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">{title}</p><p className="mt-1 text-xl font-semibold">{value == null ? "—" : String(value)}</p></div>)}
        </div>
        {refreshedAt && <p className="mt-3 text-xs text-muted-foreground">Updated {new Date(refreshedAt).toLocaleString()} · Organization-scoped records · Recent-record windows are capped.</p>}
      </Card>

      {decisions.length > 0 ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {decisions.map((decision) => (
            <article key={decision.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase ${priorityClass(decision.priority)}`}>{decision.priority} priority</span>
                <span className="text-xs text-muted-foreground">{decision.confidence} confidence</span>
                {decision.approvalRequired && <span className="rounded-full border border-border px-2.5 py-1 text-[11px]">Human approval required</span>}
              </div>
              <h3 className="mt-3 font-semibold">{decision.title}</h3>
              <p className="mt-2 text-sm">{decision.recommendation}</p>
              <p className="mt-2 text-sm text-muted-foreground">{decision.rationale}</p>
              <div className="mt-3 rounded-lg bg-muted/40 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Observed evidence</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">{decision.evidence.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Financial impact: not estimated. This recommendation does not start or approve an action.</p>
            </article>
          ))}
        </div>
      ) : !loading && !error ? (
        <Card><div className="flex items-start gap-3"><CheckCircle2 size={18} className="mt-0.5 text-primary" /><div><p className="font-medium">No immediate priority signal detected</p><p className="mt-1 text-sm text-muted-foreground">This means no matching issue was found in the observed record windows, not that the business is risk-free. Refresh after new data or execution records arrive.</p></div></div></Card>
      ) : loading ? <Card><p className="text-sm text-muted-foreground">Ranking current organization evidence…</p></Card> : null}

      <Card>
        <div className="flex items-center gap-2"><ShieldCheck size={17} /><h3 className="font-semibold">Decision safety and evidence boundaries</h3></div>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Organization-scoped", guardrails.organizationScoped],
            ["Human approval retained", guardrails.humanApprovalRequiredForGovernedExecution],
            ["Autonomous execution performed", guardrails.autonomousExecutionPerformed],
            ["Financial impact estimated", guardrails.financialImpactEstimated],
            ["Causal claims made", guardrails.causalClaimsMade],
          ].map(([title, value]) => <div key={String(title)} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2"><span>{title}</span><span className="font-medium">{value === true ? "Yes" : value === false ? "No" : "Unknown"}</span></div>)}
        </div>
        {guardrails.note && <p className="mt-3 text-xs text-muted-foreground">{guardrails.note}</p>}
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/orchestration" className="inline-flex items-center gap-2 text-sm font-medium hover:underline">Review governed execution <ArrowRight size={14} /></Link>
          <Link href="/business-outcomes" className="inline-flex items-center gap-2 text-sm font-medium hover:underline">Record outcome evidence <ArrowRight size={14} /></Link>
        </div>
      </Card>
    </section>
  )
}
