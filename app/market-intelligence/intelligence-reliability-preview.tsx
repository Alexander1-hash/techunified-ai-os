"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Download, RefreshCw, ShieldAlert } from "lucide-react";
import type { QuoteEnvelope } from "@/lib/market-intelligence/market-data";
import type { IntelligenceAuditRecord } from "@/lib/market-intelligence/orchestration-audit";
import { readRunLedger } from "@/lib/market-intelligence/run-ledger";
import { buildReliabilityReport, type ReliabilityReport } from "@/lib/market-intelligence/reliability-monitor";

const severityStyle = {
  critical: "border-rose-500/40 bg-rose-500/10 text-rose-600",
  high: "border-orange-500/40 bg-orange-500/10 text-orange-700",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-700",
  low: "border-border bg-background text-muted-foreground",
};

export default function IntelligenceReliabilityPreview() {
  const [report, setReport] = useState<ReliabilityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Reliability monitor has not run yet.");

  const runChecks = useCallback(async () => {
    setLoading(true);
    let envelope: QuoteEnvelope | null = null;
    let records: IntelligenceAuditRecord[] = [];
    const notes: string[] = [];
    try {
      const response = await fetch("/api/market-intelligence/quotes", { cache: "no-store" });
      if (!response.ok) throw new Error(`Quote endpoint returned HTTP ${response.status}`);
      envelope = await response.json() as QuoteEnvelope;
    } catch (error) {
      notes.push(error instanceof Error ? error.message : "Quote endpoint unavailable.");
    }
    try {
      records = readRunLedger(window.localStorage).records;
    } catch {
      notes.push("Browser-local run ledger is unavailable; audit checks are limited.");
    }
    const next = buildReliabilityReport(envelope, records);
    setReport(next);
    setMessage(notes.length ? notes.join(" ") : "Read-only checks completed. Findings are advisory and based only on currently available data.");
    setLoading(false);
  }, []);

  useEffect(() => { void runChecks(); }, [runChecks]);

  function exportReport() {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `techunified-reliability-report-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Reliability report exported as unsigned JSON.");
  }

  const status = report?.healthStatus ?? "checking";
  const statusClass = status === "healthy" ? "text-emerald-600" : status === "unhealthy" ? "text-rose-600" : "text-amber-700";

  return <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-sky-700"><Activity size={12}/> Reliability monitoring</div>
        <h2 className="mt-3 text-lg font-semibold">Intelligence Reliability & Data Quality</h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Read-only checks for quote validity and timestamps, source/status consistency, audit stage coverage/order, event sequencing, and governance safety invariants.</p>
      </div>
      <div className="flex gap-2 self-start">
        <button type="button" onClick={() => void runChecks()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium disabled:opacity-50"><RefreshCw size={13} className={loading ? "animate-spin" : ""}/>{loading ? "Checking…" : "Run checks"}</button>
        <button type="button" onClick={exportReport} disabled={!report} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium disabled:opacity-40"><Download size={13}/> Export</button>
      </div>
    </div>

    <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <p className="flex items-center gap-2 text-xs font-semibold"><AlertTriangle size={14}/> Important scope note</p>
      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">The current quote endpoint intentionally uses scripted demo values. This monitor does not certify data-provider reliability, prove audit tamper-resistance, or connect to broker execution.</p>
    </div>

    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article className="rounded-xl border border-border p-4"><p className="text-[10px] text-muted-foreground">Heuristic health score</p><p className={`mt-1 text-2xl font-semibold ${statusClass}`}>{report ? `${report.healthScore}/100` : "—"}</p><p className={`mt-1 text-[10px] capitalize ${statusClass}`}>{status}</p></article>
      <article className="rounded-xl border border-border p-4"><p className="text-[10px] text-muted-foreground">Quotes inspected</p><p className="mt-1 text-2xl font-semibold">{report?.quoteCount ?? "—"}</p><p className="mt-1 text-[10px] text-muted-foreground">{report?.quoteChecksPassed ?? "—"} without quote-level findings</p></article>
      <article className="rounded-xl border border-border p-4"><p className="text-[10px] text-muted-foreground">Audit records inspected</p><p className="mt-1 text-2xl font-semibold">{report?.auditCount ?? "—"}</p><p className="mt-1 text-[10px] text-muted-foreground">{report?.auditChecksPassed ?? "—"} without audit/governance findings</p></article>
      <article className="rounded-xl border border-border p-4"><p className="text-[10px] text-muted-foreground">Detected findings</p><p className="mt-1 text-2xl font-semibold">{report?.issues.length ?? "—"}</p><p className="mt-1 text-[10px] text-muted-foreground">{report?.issueCounts.critical ?? 0} critical · {report?.issueCounts.high ?? 0} high</p></article>
    </div>

    <div className="mt-4 flex flex-wrap gap-2">
      {(["critical", "high", "medium", "low"] as const).map(level => <span key={level} className={`rounded-full border px-2.5 py-1 text-[10px] ${severityStyle[level]}`}>{level}: {report?.issueCounts[level] ?? 0}</span>)}
    </div>

    <div className="mt-4 space-y-2">
      {(report?.issues ?? []).slice(0, 12).map((item, index) => <article key={`${item.code}-${item.reference}-${index}`} className="flex flex-col justify-between gap-2 rounded-xl border border-border bg-background p-3 sm:flex-row sm:items-start">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><ShieldAlert size={13}/><span className="text-xs font-semibold">{item.code}</span><span className={`rounded-full border px-2 py-0.5 text-[9px] ${severityStyle[item.severity]}`}>{item.severity}</span></div><p className="mt-1 text-[11px] leading-5 text-muted-foreground">{item.message}</p><p className="mt-1 break-all text-[10px] text-muted-foreground">{item.reference} · {item.area}</p></div>
      </article>)}
      {report?.issues.length === 0 && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-xs text-emerald-700"><CheckCircle2 size={15} className="mr-2 inline"/>No issues detected in the inspected snapshot. This is not a guarantee of correctness.</div>}
      {report && report.issues.length > 12 && <p className="text-[10px] text-muted-foreground">Showing the 12 highest-priority findings. Export JSON for the full report (up to 100 findings).</p>}
    </div>

    <div className="mt-4 rounded-xl border border-border p-4"><h3 className="text-xs font-semibold">Monitor limitations</h3><ul className="mt-2 space-y-1 text-[11px] leading-5 text-muted-foreground">{(report?.limitations ?? ["Checks run locally in the browser against the quote endpoint and browser-local ledger."]).map(item => <li key={item}>• {item}</li>)}</ul></div>
    <p role="status" className="mt-3 text-[11px] text-muted-foreground">{message}</p>
  </section>;
}
