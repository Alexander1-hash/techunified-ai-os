"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Download, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { readRunLedger } from "@/lib/market-intelligence/run-ledger";
import { buildReliabilityReport, type ReliabilityReport } from "@/lib/market-intelligence/reliability-monitor";
import { readIncidentSnapshot, type IncidentSnapshot } from "@/lib/market-intelligence/incident-management";
import type { QuoteEnvelope } from "@/lib/market-intelligence/market-data";
import type { IntelligenceAuditRecord } from "@/lib/market-intelligence/orchestration-audit";

type ModuleState = "operational" | "attention" | "blocked" | "no-data";
type ModuleHealth = { name: string; state: ModuleState; detail: string };

function badge(state: ModuleState) {
  if (state === "operational") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  if (state === "blocked") return "border-rose-500/30 bg-rose-500/10 text-rose-600";
  if (state === "attention") return "border-amber-500/30 bg-amber-500/10 text-amber-700";
  return "border-border bg-background text-muted-foreground";
}

export default function IntelligenceOperationsCenterPreview() {
  const [report, setReport] = useState<ReliabilityReport | null>(null);
  const [incidents, setIncidents] = useState<IncidentSnapshot | null>(null);
  const [records, setRecords] = useState<IntelligenceAuditRecord[]>([]);
  const [quoteMode, setQuoteMode] = useState("unknown");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Operations overview has not been refreshed.");

  const refresh = useCallback(async () => {
    setLoading(true);
    let envelope: QuoteEnvelope | null = null;
    const notes: string[] = [];
    try {
      const response = await fetch("/api/market-intelligence/quotes", { cache: "no-store" });
      if (!response.ok) throw new Error(`Quote endpoint returned HTTP ${response.status}`);
      envelope = await response.json() as QuoteEnvelope;
      setQuoteMode(envelope.dataMode === "simulation" ? "Simulation / demo" : String(envelope.dataMode));
    } catch (error) {
      notes.push(error instanceof Error ? error.message : "Market-data endpoint unavailable.");
      setQuoteMode("Unavailable");
    }

    try {
      const ledger = readRunLedger(window.localStorage);
      const savedIncidents = readIncidentSnapshot(window.localStorage);
      setRecords(ledger.records);
      setIncidents(savedIncidents);
      setReport(buildReliabilityReport(envelope, ledger.records));
      setMessage(notes.length ? notes.join(" ") : "Overview refreshed from the current quote endpoint and this browser's saved research records.");
    } catch {
      setRecords([]);
      setIncidents(null);
      setReport(buildReliabilityReport(envelope, []));
      setMessage("Browser-local history is unavailable; the overview is incomplete.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const activeIncidents = (incidents?.incidents ?? []).filter(item => item.status !== "resolved");
  const critical = activeIncidents.filter(item => item.severity === "critical").length;
  const high = activeIncidents.filter(item => item.severity === "high").length;
  const recentTrend = incidents?.trend.at(-1);
  const governanceSafe = records.every(record => record.mode === "research-only" && record.policy?.eligibleForExecution === false && record.policy?.approvedNotional === 0);
  const stageCoverage = records.length === 0 ? null : Math.round(records.reduce((sum, record) => {
    const present = new Set((record.stages ?? []).map(stage => stage.stage));
    return sum + (present.size / 6) * 100;
  }, 0) / records.length);

  const modules: ModuleHealth[] = [
    { name: "Market data", state: quoteMode === "Simulation / demo" ? "attention" : quoteMode === "Unavailable" ? "blocked" : "operational", detail: quoteMode === "Simulation / demo" ? "Scripted feed only; live provider not connected." : quoteMode },
    { name: "Reliability monitor", state: !report ? "no-data" : report.healthStatus === "healthy" ? "operational" : report.healthStatus === "no-data" ? "no-data" : report.healthStatus === "unhealthy" ? "blocked" : "attention", detail: report ? `Score ${report.healthScore}/100 · ${report.healthStatus}` : "Waiting for a report." },
    { name: "Incident queue", state: critical > 0 ? "blocked" : activeIncidents.length > 0 ? "attention" : incidents ? "operational" : "no-data", detail: `${activeIncidents.length} active · ${critical} critical · ${high} high` },
    { name: "Research ledger", state: records.length > 0 ? "operational" : "no-data", detail: `${records.length} browser-local audit record(s)` },
    { name: "Execution governance", state: !records.length ? "no-data" : governanceSafe ? "operational" : "blocked", detail: governanceSafe ? "Saved records preserve research-only policy." : "At least one record violates the execution invariant." },
    { name: "Evidence coverage", state: stageCoverage === null ? "no-data" : stageCoverage >= 95 ? "operational" : stageCoverage >= 70 ? "attention" : "blocked", detail: stageCoverage === null ? "No saved runs to evaluate." : `Average required-stage coverage ${stageCoverage}%` },
  ];

  function exportSnapshot() {
    const payload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      product: "TechUnifiedAIOS Intelligence Operations Center",
      summary: {
        reliabilityScore: report?.healthScore ?? null,
        reliabilityStatus: report?.healthStatus ?? "unavailable",
        activeIncidents: activeIncidents.length,
        criticalIncidents: critical,
        highIncidents: high,
        auditRecords: records.length,
        averageStageCoveragePercent: stageCoverage,
        quoteMode,
        governanceSafe,
        latestTrend: recentTrend ?? null,
      },
      modules,
      reliabilityFindings: report?.issues ?? [],
      incidents: incidents?.incidents ?? [],
      limitations: [
        "This is an operational summary, not a live production observability backend.",
        "Incident and audit records are browser-local, editable, and may differ between browsers or devices.",
        "The current market-data feed is scripted demonstration data, not a live provider.",
        "No live trading, broker execution, capital authorization, or financial-performance claim is enabled.",
        "Exported JSON is unsigned and is not tamper-proof evidence.",
      ],
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `techunified-operations-center-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Operations snapshot exported as unsigned JSON.");
  }

  return <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-indigo-700"><Activity size={12}/> Operations overview</div>
        <h2 className="mt-3 text-lg font-semibold">Intelligence Operations Center</h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">One read-only view across market-data mode, reliability, incidents, saved evidence, and research governance.</p>
      </div>
      <div className="flex gap-2 self-start">
        <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium disabled:opacity-50"><RefreshCw size={13} className={loading ? "animate-spin" : ""}/>{loading ? "Refreshing…" : "Refresh"}</button>
        <button type="button" onClick={exportSnapshot} disabled={!report} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium disabled:opacity-40"><Download size={13}/> Export</button>
      </div>
    </div>

    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article className="rounded-xl border border-border p-4"><p className="text-[10px] text-muted-foreground">Reliability score</p><p className="mt-1 text-2xl font-semibold">{report ? `${report.healthScore}/100` : "—"}</p><p className="mt-1 text-[10px] capitalize text-muted-foreground">{report?.healthStatus ?? "Not available"}</p></article>
      <article className="rounded-xl border border-border p-4"><p className="text-[10px] text-muted-foreground">Active incidents</p><p className="mt-1 text-2xl font-semibold">{activeIncidents.length}</p><p className="mt-1 text-[10px] text-muted-foreground">{critical} critical · {high} high</p></article>
      <article className="rounded-xl border border-border p-4"><p className="text-[10px] text-muted-foreground">Saved audit records</p><p className="mt-1 text-2xl font-semibold">{records.length}</p><p className="mt-1 text-[10px] text-muted-foreground">{stageCoverage === null ? "No stage coverage sample" : `${stageCoverage}% average stage coverage`}</p></article>
      <article className="rounded-xl border border-border p-4"><p className="text-[10px] text-muted-foreground">Market-data mode</p><p className="mt-1 text-lg font-semibold">{quoteMode}</p><p className="mt-1 text-[10px] text-muted-foreground">Current endpoint response</p></article>
    </div>

    <div className="mt-5 flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">Module health</h3><p className="mt-1 text-[10px] text-muted-foreground">Status is based on local evidence and current endpoint availability, not external uptime checks.</p></div><span className="text-[10px] text-muted-foreground">{modules.filter(item => item.state === "blocked").length} blocked · {modules.filter(item => item.state === "attention").length} attention</span></div>
    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {modules.map(item => <article key={item.name} className="rounded-xl border border-border bg-background p-4"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold">{item.name}</p><span className={`rounded-full border px-2 py-1 text-[9px] capitalize ${badge(item.state)}`}>{item.state}</span></div><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{item.detail}</p></article>)}
    </div>

    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <article className="rounded-xl border border-border p-4"><h3 className="flex items-center gap-2 text-xs font-semibold"><ShieldCheck size={14}/> Execution safety boundary</h3><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{governanceSafe ? "Saved research records preserve eligibleForExecution=false and approvedNotional=0." : "No records are available, or at least one saved record violates the expected research-only invariant."} This local check is not a substitute for server-side authorization.</p></article>
      <article className="rounded-xl border border-border p-4"><h3 className="flex items-center gap-2 text-xs font-semibold"><TriangleAlert size={14}/> Current limitations</h3><p className="mt-2 text-[11px] leading-5 text-muted-foreground">No centralized event store, external alert delivery, live feed validation, or cross-device incident synchronization is configured. {recentTrend ? `Last saved trend checkpoint: ${new Date(recentTrend.capturedAt).toLocaleString()}.` : "No saved health trend checkpoint is available."}</p></article>
    </div>
    <p role="status" className="mt-3 text-[11px] text-muted-foreground">{message}</p>
  </section>;
}
