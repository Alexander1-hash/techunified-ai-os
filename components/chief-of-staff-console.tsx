"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, ClipboardCheck, RefreshCw, ShieldCheck, Target } from "lucide-react"
import { Card, PageHeader } from "@/components/ui"

type Payload = Record<string, any>

function list(value: unknown): Payload[] {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") as Payload[] : []
}

function label(value: unknown, fallback = "Not available") {
  return typeof value === "string" && value.trim() ? value.replace(/_/g, " ") : fallback
}

function Metric({ title, value, detail }: { title: string; value: string | number; detail: string }) {
  return (
    <Card>
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </Card>
  )
}

export default function ChiefOfStaffConsole() {
  const [data, setData] = useState<{ priorities: Payload; approvals: Payload[]; actions: Payload[]; outcomes: Payload[] }>({
    priorities: {},
    approvals: [],
    actions: [],
    outcomes: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const sources = [
        { key: "priorities", path: "/api/business/orchestration/priorities" },
        { key: "briefing", path: "/api/business/chief-of-staff" },
      ] as const
      const results = await Promise.allSettled(sources.map(async (source) => {
        const response = await fetch(source.path, { cache: "no-store" })
        const body = await response.json().catch(() => ({})) as Payload
        if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : `HTTP ${response.status}`)
        return { key: source.key, body }
      }))
      const next = { priorities: {} as Payload, approvals: [] as Payload[], actions: [] as Payload[], outcomes: [] as Payload[] }
      const failures: string[] = []
      results.forEach((result, index) => {
        const source = sources[index]
        if (result.status === "rejected") {
          failures.push(`${source.key}: ${result.reason instanceof Error ? result.reason.message : "request failed"}`)
          return
        }
        const { key, body } = result.value
        if (key === "priorities") next.priorities = body
        if (key === "briefing") {
          next.approvals = list(body.approvals)
          next.actions = list(body.actionRuns)
          next.outcomes = list(body.outcomes)
          if (!next.priorities.nextMove && body.nextMove) next.priorities.nextMove = body.nextMove
          if (!next.priorities.intelligenceCore && body.intelligenceCore) next.priorities.intelligenceCore = body.intelligenceCore
        }
      })
      setData(next)
      const briefingResult = results.find((result) => result.status === "fulfilled" && result.value.key === "briefing")
      if (briefingResult?.status === "fulfilled" && briefingResult.value.body.partial === true) {
        const unavailable = list(briefingResult.value.body.failedSources).map((item) => String(item)).join(", ")
        failures.push(`briefing data sources unavailable${unavailable ? `: ${unavailable}` : ""}`)
      }
      setError(failures.length ? `Some briefing sources could not be loaded: ${failures.join("; ")}` : null)
      setRefreshedAt(new Date().toISOString())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load the Chief of Staff briefing.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const objectives = list(data.priorities.objectives)
  const pendingApprovals = data.approvals.filter((item) => String(item.status).toLowerCase() === "pending")
  const failedActions = data.actions.filter((item) => ["failed", "error"].includes(String(item.status).toLowerCase()))
  const activeActions = data.actions.filter((item) => ["running", "pending", "queued"].includes(String(item.status).toLowerCase()))
  const verifiedOutcomes = data.outcomes.filter((item) => ["measured", "attributed", "verified"].includes(String(item.evidence_status).toLowerCase()))
  const nextMove = data.priorities.nextMove && typeof data.priorities.nextMove === "object" ? data.priorities.nextMove as Payload : null
  const core = data.priorities.intelligenceCore && typeof data.priorities.intelligenceCore === "object" ? data.priorities.intelligenceCore as Payload : {}

  return (
    <main className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          eyebrow="Executive Operations"
          title="Chief of Staff"
          subtitle="One evidence-led briefing across company objectives, Intelligence Core, human approvals, execution health, and measured outcomes."
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {refreshedAt ? `Last refreshed ${new Date(refreshedAt).toLocaleString()}` : "Live company data"}
            {" · "}Recommendations do not execute actions.
          </p>
          <button onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh briefing
          </button>
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-destructive" />
            <div><p className="font-medium">Briefing is incomplete</p><p className="mt-1 text-muted-foreground">{error}</p><button onClick={() => void refresh()} className="mt-2 underline underline-offset-4">Retry</button></div>
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="Company objectives" value={loading ? "…" : objectives.length} detail="Current portfolio priority signals" />
          <Metric title="Approvals awaiting review" value={loading ? "…" : pendingApprovals.length} detail="Human decision required" />
          <Metric title="Failed action runs" value={loading ? "…" : failedActions.length} detail="Investigate before retrying work" />
          <Metric title="Evidence-backed outcomes" value={loading ? "…" : verifiedOutcomes.length} detail="Measured, attributed, or verified records" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <div className="flex items-center gap-2"><Target size={18} /><h2 className="text-base font-semibold">Recommended next move</h2></div>
            {loading && !nextMove ? <p className="mt-4 text-sm text-muted-foreground">Preparing the company briefing…</p> : nextMove ? (
              <div className="mt-4 space-y-3">
                <p className="text-lg font-semibold">{label(nextMove.action, "Review company portfolio")}</p>
                <p className="text-sm text-muted-foreground">{label(nextMove.reason, "No recommendation reason was returned.")}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-muted px-2.5 py-1">Evidence: {label(nextMove.evidence, "low")}</span>
                  <span className="rounded-full bg-muted px-2.5 py-1">Execution: {label(nextMove.execution, "not started")}</span>
                  <span className="rounded-full bg-muted px-2.5 py-1">Approval: {label(nextMove.approval, "check required")}</span>
                </div>
                <p className="text-xs text-muted-foreground">This is a recommendation, not proof of business impact or permission to execute.</p>
                <Link href="/orchestration" className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">Open orchestration <ArrowRight size={15} /></Link>
              </div>
            ) : <p className="mt-4 text-sm text-muted-foreground">No next move is available yet. Add objectives and connect business data to build the evidence base.</p>}
          </Card>

          <Card>
            <div className="flex items-center gap-2"><ShieldCheck size={18} /><h2 className="text-base font-semibold">Governance and intelligence</h2></div>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Intelligence Core</dt><dd className="font-medium">{core.available || Array.isArray(core.decisions) || data.priorities.adaptiveSummary?.intelligenceCoreInfluence?.available ? "Available" : "No current snapshot"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Core decisions</dt><dd className="font-medium">{Array.isArray(core.decisions) ? core.decisions.length : Number(data.priorities.adaptiveSummary?.intelligenceCoreInfluence?.decisionCount ?? 0)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Contradictions</dt><dd className="font-medium">{Array.isArray(core.contradictions) ? core.contradictions.length : Number(data.priorities.adaptiveSummary?.intelligenceCoreInfluence?.contradictionCount ?? 0)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Active action runs</dt><dd className="font-medium">{activeActions.length}</dd></div>
            </dl>
            <p className="mt-4 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">Consequential work must remain subject to the application’s explicit approval controls. Missing evidence is shown as a gap, not a positive result.</p>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Activity size={18} /><h2 className="text-base font-semibold">Highest-priority objectives</h2></div><Link href="/orchestration" className="text-xs text-muted-foreground hover:text-foreground">View orchestration →</Link></div>
            <div className="mt-4 space-y-3">
              {objectives.slice(0, 6).map((objective, index) => (
                <div key={String(objective.id ?? index)} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-3"><p className="text-sm font-medium">{label(objective.title, "Company objective")}</p><span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs">{Number(objective.priorityScore ?? 0)}/100</span></div>
                  <p className="mt-1 text-xs text-muted-foreground">{label(objective.priorityReason, "Priority reason not available.")}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground"><span>{Number(objective.activeRuns ?? 0)} active</span><span>·</span><span>{Number(objective.pendingApprovalRuns ?? 0)} approvals</span><span>·</span><span>{Number(objective.failedRuns ?? 0)} failed</span><span>·</span><span>{Number(objective.verifiedOutcomes ?? 0)} verified outcomes</span></div>
                </div>
              ))}
              {!loading && objectives.length === 0 && <p className="text-sm text-muted-foreground">No objectives found for the current organization.</p>}
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2"><ClipboardCheck size={18} /><h2 className="text-base font-semibold">Approval queue</h2></div>
            <div className="mt-4 space-y-3">
              {pendingApprovals.slice(0, 6).map((approval, index) => (
                <div key={String(approval.id ?? index)} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-medium">{label(approval.title, "Approval request")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{label(approval.action_type, "action")} · Requested {approval.requested_at ? new Date(String(approval.requested_at)).toLocaleString() : "time unavailable"}</p>
                  {approval.reason && <p className="mt-2 text-xs text-muted-foreground">{String(approval.reason)}</p>}
                </div>
              ))}
              {!loading && pendingApprovals.length === 0 && <div className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 size={16} /> No pending agent approvals.</div>}
              <Link href="/agents" className="inline-flex items-center gap-2 text-sm font-medium hover:underline">Review agents and approvals <ArrowRight size={15} /></Link>
            </div>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <div className="flex items-center gap-2"><AlertTriangle size={18} /><h2 className="text-base font-semibold">Execution issues</h2></div>
            <div className="mt-4 space-y-3">
              {failedActions.slice(0, 6).map((run, index) => (
                <div key={String(run.id ?? index)} className="rounded-lg border border-destructive/20 p-3">
                  <p className="text-sm font-medium">{label(run.decision_title, "Business action")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{label(run.error_message, "Failure details unavailable.")}</p>
                </div>
              ))}
              {!loading && failedActions.length === 0 && <p className="text-sm text-muted-foreground">No failed action runs were returned by the current data source.</p>}
              <Link href="/business-outcomes" className="inline-flex items-center gap-2 text-sm font-medium hover:underline">Review outcomes and evidence <ArrowRight size={15} /></Link>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-2"><CheckCircle2 size={18} /><h2 className="text-base font-semibold">Outcome evidence</h2></div>
            <div className="mt-4 space-y-3">
              {verifiedOutcomes.slice(0, 6).map((outcome, index) => (
                <div key={String(outcome.id ?? index)} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-3"><p className="text-sm font-medium">{label(outcome.title, "Business outcome")}</p><span className="shrink-0 text-xs text-muted-foreground">{label(outcome.evidence_status)}</span></div>
                  <p className="mt-1 text-xs text-muted-foreground">{label(outcome.outcome_type, "Outcome")}{outcome.period_end ? ` · Period end ${String(outcome.period_end)}` : ""}</p>
                </div>
              ))}
              {!loading && verifiedOutcomes.length === 0 && <p className="text-sm text-muted-foreground">No measured or attributed outcomes are available yet. Do not treat estimates as verified ROI.</p>}
            </div>
          </Card>
        </section>
      </div>
    </main>
  )
}
