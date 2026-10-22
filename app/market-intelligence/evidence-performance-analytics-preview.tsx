"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Download, ShieldCheck, TrendingUp } from "lucide-react";
import { readRunLedger, type RunLedgerSnapshot } from "@/lib/market-intelligence/run-ledger";
import { summarizeIntelligenceRuns } from "@/lib/market-intelligence/evidence-performance-analytics";

export default function EvidencePerformanceAnalyticsPreview() {
  const [snapshot, setSnapshot] = useState<RunLedgerSnapshot | null>(null);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  useEffect(() => {
    try {
      setSnapshot(readRunLedger(window.localStorage));
    } catch {
      setStorageUnavailable(true);
      setSnapshot({ schemaVersion: 1, updatedAt: new Date(0).toISOString(), records: [] });
    }
  }, []);

  const report = useMemo(
    () => summarizeIntelligenceRuns(snapshot?.records ?? []),
    [snapshot],
  );

  function exportReport() {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `techunified-evidence-analytics-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const outcomeTotal = report.runCount || 1;
  return <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground"><Activity size={12}/> Evidence analytics</div>
        <h2 className="mt-3 text-lg font-semibold">Intelligence Evidence & Governance Analytics</h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Summarizes the locally retained run ledger to expose evidence coverage, audit completeness, and recurring governance blockers.</p>
      </div>
      <button type="button" onClick={exportReport} className="inline-flex items-center gap-2 self-start rounded-lg border border-border px-3 py-2 text-xs font-medium"><Download size={14}/> Export report</button>
    </div>

    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-xl border border-border p-4"><p className="text-[10px] text-muted-foreground">Runs analyzed</p><p className="mt-1 text-2xl font-semibold">{report.runCount}</p><p className="mt-1 text-[10px] text-muted-foreground">Current browser only</p></div>
      <div className="rounded-xl border border-border p-4"><p className="text-[10px] text-muted-foreground">Complete audit snapshots</p><p className="mt-1 text-2xl font-semibold">{report.auditCompletenessPercent}%</p><p className="mt-1 text-[10px] text-muted-foreground">{report.completeAuditCount} of {report.runCount} runs</p></div>
      <div className="rounded-xl border border-border p-4"><p className="text-[10px] text-muted-foreground">Blocked outcomes</p><p className="mt-1 text-2xl font-semibold">{report.outcomeCounts.blocked}</p><p className="mt-1 text-[10px] text-muted-foreground">{(report.outcomeCounts.blocked / outcomeTotal * 100).toFixed(1)}% of retained runs</p></div>
      <div className="rounded-xl border border-border p-4"><p className="text-[10px] text-muted-foreground">Research-only outcomes</p><p className="mt-1 text-2xl font-semibold">{report.outcomeCounts["research-only"] + report.outcomeCounts["requires-human-review"]}</p><p className="mt-1 text-[10px] text-muted-foreground">Never execution-authorized</p></div>
    </div>

    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={15}/> Stage evidence coverage</h3>
        <p className="mt-1 text-[10px] text-muted-foreground">Percentage of retained runs that include each stage.</p>
        <div className="mt-3 space-y-3">
          {report.stageAnalytics.map(stage => <div key={stage.stage}>
            <div className="mb-1 flex justify-between gap-3 text-[11px]"><span>{stage.stage.replaceAll("-", " ")}</span><span>{stage.coveragePercent}% · {stage.runs}/{report.runCount}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-foreground/70" style={{ width: `${Math.min(100, stage.coveragePercent)}%` }}/></div>
            <p className="mt-1 text-[10px] text-muted-foreground">Passed {stage.passed} · Blocked {stage.blocked} · Incomplete {stage.incomplete} · Research-only {stage.researchOnly}</p>
          </div>)}
          {report.runCount === 0 && <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">No retained history found. Generate or save runs in the Run Ledger first.</p>}
        </div>
      </div>
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle size={15}/> Most frequent policy blockers</h3>
        <p className="mt-1 text-[10px] text-muted-foreground">Counts of blocker events across retained audit snapshots.</p>
        <div className="mt-3 space-y-2">
          {report.blockerCounts.map(item => <div key={item.code} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"><span className="break-all text-[11px]">{item.code}</span><span className="shrink-0 rounded-full border border-border px-2 py-1 text-[10px]">{item.count}</span></div>)}
          {report.blockerCounts.length === 0 && <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">No blocker events in the available ledger.</p>}
        </div>
      </div>
    </div>

    <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <h3 className="flex items-center gap-2 text-xs font-semibold"><TrendingUp size={14}/> Interpretation guardrails</h3>
      <ul className="mt-2 space-y-1 text-[11px] leading-5 text-muted-foreground">{report.caveats.map(caveat => <li key={caveat}>• {caveat}</li>)}</ul>
      {storageUnavailable && <p className="mt-2 text-[11px] font-medium text-amber-700">Browser storage is unavailable; no persisted run history could be read.</p>}
    </div>
    <p className="mt-3 text-[10px] text-muted-foreground">Report generated {new Date(report.generatedAt).toLocaleString()} · schema v{report.schemaVersion}</p>
  </section>;
}
