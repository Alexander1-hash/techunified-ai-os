"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Database, FileWarning, History, Trash2 } from "lucide-react";
import { getDemoQuoteEnvelope } from "@/lib/market-intelligence/market-data";
import { evaluateQuote } from "@/lib/market-intelligence/strategy-engine";
import { SYNTHETIC_SAMPLE_BARS } from "@/lib/market-intelligence/backtesting";
import { runWalkForwardValidation } from "@/lib/market-intelligence/strategy-validation";
import { detectOpportunity } from "@/lib/market-intelligence/opportunity-detection";
import { assessRisk } from "@/lib/market-intelligence/risk-engine";
import { evaluateDecisionGovernance } from "@/lib/market-intelligence/decision-governance";
import { createIntelligenceAudit, type StageEvidence } from "@/lib/market-intelligence/orchestration-audit";
import { appendRunLedgerRecord, clearRunLedger, exportRunLedger, readRunLedger, RUN_LEDGER_MAX_RECORDS, type RunLedgerSnapshot } from "@/lib/market-intelligence/run-ledger";

function createDemoRecords() {
  const envelope = getDemoQuoteEnvelope();
  const validation = runWalkForwardValidation(SYNTHETIC_SAMPLE_BARS, {
    startingBalance: 10000, positionNotional: 500, feeBpsPerSide: 5,
    candidateLookbacks: [1, 2], trainingBars: 6, validationBars: 4, stepBars: 2,
  });
  return envelope.quotes.map(quote => {
    const signal = evaluateQuote(quote);
    const opportunity = detectOpportunity(signal, validation);
    const entry = Number.isFinite(quote.price) && quote.price > 0 ? quote.price : 1;
    const risk = assessRisk({
      accountEquity: 10000, currentEquity: 10000, peakEquity: 10000,
      existingExposure: 0, openPositions: 0, entryPrice: entry,
      stopPrice: entry * (signal.direction === "bearish" ? 1.02 : 0.98),
      proposedNotional: 250,
      policy: { maxRiskPerTradePercent: 1, maxExposurePercent: 20, maxDrawdownPercent: 10, maxOpenPositions: 3 },
    });
    const decision = evaluateDecisionGovernance({ signal, opportunity, risk, validation });
    const stages: StageEvidence[] = [
      { stage: "market-data", status: quote.source === "provider" && quote.status === "live" ? "passed" : "research-only", reference: quote.source, detail: `Quote status ${quote.status}; observed ${quote.observedAt}.` },
      { stage: "strategy", status: signal.eligibleForExecution === false ? "research-only" : "incomplete", reference: signal.strategyId, detail: `Directional observation ${signal.direction}; no predictive claim.` },
      { stage: "opportunity", status: opportunity.state === "blocked" ? "blocked" : "research-only", reference: opportunity.symbol, detail: `${opportunity.blockers.length} blocker(s) recorded.` },
      { stage: "validation", status: validation.status === "completed" ? "research-only" : "incomplete", reference: "walk-forward-v1", detail: `${validation.folds.length} fold(s); data label ${validation.dataLabel}.` },
      { stage: "risk", status: risk.status === "blocked" ? "blocked" : "research-only", reference: "risk-policy-v1", detail: `${risk.checks.filter(check => !check.passed).length} failed check(s); approved notional 0.` },
      { stage: "governance", status: decision.outcome === "blocked" ? "blocked" : "research-only", reference: decision.symbol, detail: `Outcome ${decision.outcome}; ${decision.reasons.length} reason(s).` },
    ];
    return createIntelligenceAudit(decision, stages);
  });
}

export default function PersistentRunLedgerPreview() {
  const demoRecords = useMemo(() => createDemoRecords(), []);
  const [snapshot, setSnapshot] = useState<RunLedgerSnapshot | null>(null);
  const [message, setMessage] = useState("Loading browser-local run history…");
  const [storageAvailable, setStorageAvailable] = useState(true);

  useEffect(() => {
    try {
      let current = readRunLedger(window.localStorage);
      for (const record of demoRecords) current = appendRunLedgerRecord(window.localStorage, record);
      setSnapshot(current);
      setMessage(`Saved ${demoRecords.length} new research snapshot(s) in this browser.`);
    } catch {
      setStorageAvailable(false);
      setSnapshot({ schemaVersion: 1, updatedAt: new Date().toISOString(), records: demoRecords });
      setMessage("Browser storage is unavailable. Showing this session only; history was not persisted.");
    }
  }, [demoRecords]);

  function downloadExport() {
    if (!snapshot) return;
    const blob = new Blob([exportRunLedger(snapshot)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `techunified-run-ledger-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Run ledger export prepared. The JSON file is not digitally signed.");
  }

  function clearHistory() {
    if (!window.confirm("Clear all TechUnifiedAIOS run history stored in this browser? This cannot be undone.")) return;
    try {
      clearRunLedger(window.localStorage);
      setSnapshot({ schemaVersion: 1, updatedAt: new Date().toISOString(), records: [] });
      setMessage("Browser-local history cleared.");
      setStorageAvailable(true);
    } catch {
      setMessage("Unable to clear browser storage.");
    }
  }

  return <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-emerald-700"><Database size={12}/> Persistent run ledger</div>
        <h2 className="mt-3 text-lg font-semibold">Intelligence Run Ledger · v1.0.0</h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Keeps a bounded history of research audit snapshots in this browser, with export and clear-history controls.</p>
      </div>
      <span className="self-start rounded-full border border-amber-500/30 px-2.5 py-1 text-[10px] text-amber-700">Browser-local storage</span>
    </div>

    <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <h3 className="flex items-center gap-2 text-xs font-semibold"><FileWarning size={14}/> Scope and data ownership</h3>
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">History stays in this browser profile and is not synchronized across devices or users. Browser storage can be cleared by the browser and is not a secure, tamper-proof, server-side audit system. Records remain research-only and contain no authorization to trade.</p>
    </div>

    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-border p-4"><p className="text-[10px] text-muted-foreground">Stored snapshots</p><p className="mt-1 text-2xl font-semibold">{snapshot?.records.length ?? "—"}</p><p className="mt-1 text-[10px] text-muted-foreground">Maximum {RUN_LEDGER_MAX_RECORDS}</p></div>
      <div className="rounded-xl border border-border p-4"><p className="text-[10px] text-muted-foreground">Last updated</p><p className="mt-1 text-sm font-semibold">{snapshot?.updatedAt && Date.parse(snapshot.updatedAt) > 0 ? new Date(snapshot.updatedAt).toLocaleString() : "Not yet saved"}</p><p className="mt-1 text-[10px] text-muted-foreground">Local browser timestamp</p></div>
      <div className="rounded-xl border border-border p-4"><p className="text-[10px] text-muted-foreground">Storage status</p><p className="mt-1 text-sm font-semibold">{snapshot ? (storageAvailable ? "Available" : "Session only") : "Loading"}</p><p className="mt-1 text-[10px] text-muted-foreground">No cloud sync configured</p></div>
    </div>

    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" onClick={downloadExport} disabled={!snapshot || snapshot.records.length === 0} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40"><Download size={14}/> Export JSON</button>
      <button type="button" onClick={clearHistory} disabled={!snapshot || snapshot.records.length === 0} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40"><Trash2 size={14}/> Clear history</button>
    </div>
    <p role="status" className="mt-3 text-[11px] text-muted-foreground">{message}</p>

    <div className="mt-4 space-y-2">
      {(snapshot?.records ?? []).slice(0, 8).map(record => <article key={record.runId} className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-background p-3 sm:flex-row sm:items-center">
        <div className="min-w-0"><div className="flex items-center gap-2"><History size={13}/><span className="text-xs font-semibold">{record.runId.split("-").slice(-1)[0]}</span><span className="rounded-full border border-rose-500/30 px-2 py-0.5 text-[10px] text-rose-600">{record.finalOutcome}</span></div><p className="mt-1 break-all text-[10px] text-muted-foreground">{record.runId}</p><p className="mt-1 text-[10px] text-muted-foreground">{new Date(record.createdAt).toLocaleString()} · {record.events.length} audit events · {record.stages.length}/6 stages</p></div>
        <div className="shrink-0 text-right"><p className="text-[10px] text-muted-foreground">Execution eligible</p><p className="text-xs font-semibold">No · approved capital 0</p></div>
      </article>)}
      {snapshot?.records.length === 0 && <p className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">No saved runs. A new research snapshot will be created on the next page load.</p>}
    </div>
  </section>;
}
