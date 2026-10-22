"use client";

import { useMemo } from "react";
import { ClipboardList, FileWarning, ShieldCheck } from "lucide-react";
import { getDemoQuoteEnvelope } from "@/lib/market-intelligence/market-data";
import { evaluateQuote } from "@/lib/market-intelligence/strategy-engine";
import { SYNTHETIC_SAMPLE_BARS } from "@/lib/market-intelligence/backtesting";
import { runWalkForwardValidation } from "@/lib/market-intelligence/strategy-validation";
import { detectOpportunity } from "@/lib/market-intelligence/opportunity-detection";
import { assessRisk } from "@/lib/market-intelligence/risk-engine";
import { evaluateDecisionGovernance } from "@/lib/market-intelligence/decision-governance";
import { createIntelligenceAudit, INTELLIGENCE_STAGE_LABELS, type StageEvidence } from "@/lib/market-intelligence/orchestration-audit";

export default function OrchestrationAuditPreview() {
  const records = useMemo(() => {
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
  }, []);

  return <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-sky-700"><ClipboardList size={12}/> Orchestration & audit</div>
        <h2 className="mt-3 text-lg font-semibold">Intelligence Orchestration & Audit Engine · v1.0.0</h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Builds an ordered evidence trail across market data, strategy, opportunity, validation, risk, and governance. Incomplete stages and policy blockers remain visible.</p>
      </div>
      <span className="self-start rounded-full border border-amber-500/30 px-2.5 py-1 text-[10px] text-amber-700">In-memory demo audit</span>
    </div>

    <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <h3 className="flex items-center gap-2 text-xs font-semibold"><FileWarning size={14}/> Audit durability is not enabled</h3>
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">These are generated preview records, not tamper-proof or persisted audit logs. Durable use requires authenticated append-only storage, retention, access controls, and independent integrity checks.</p>
    </div>

    <div className="mt-4 grid gap-3 lg:grid-cols-3">
      {records.map(record => <article key={record.runId} className="rounded-xl border border-border bg-background p-4">
        <div className="flex items-start justify-between gap-2"><div><h3 className="text-sm font-semibold">{record.runId.split("-").slice(-1)[0]}</h3><p className="mt-1 break-all text-[10px] text-muted-foreground">{record.runId}</p></div><span className="rounded-full border border-rose-500/30 bg-rose-500/5 px-2 py-1 text-[10px] text-rose-600">{record.finalOutcome}</span></div>
        <div className="mt-3 flex items-center justify-between rounded-lg border border-border p-3"><span className="text-[10px] text-muted-foreground">Evidence stages</span><span className="text-xs font-semibold">{record.stages.length}/6</span></div>
        <div className="mt-3 space-y-2">{record.stages.map(stage => <div key={stage.stage} className="rounded-lg border border-border p-3"><div className="flex items-center justify-between gap-2"><span className="text-[11px] font-medium">{INTELLIGENCE_STAGE_LABELS[stage.stage]}</span><span className={`text-[10px] ${stage.status === "blocked" || stage.status === "incomplete" ? "text-rose-600" : "text-amber-700"}`}>{stage.status}</span></div><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{stage.detail}</p></div>)}</div>
        <div className="mt-3 rounded-lg border border-border p-3"><div className="flex items-center gap-2 text-[11px] font-semibold"><ShieldCheck size={13}/> Audit integrity</div><p className="mt-1 text-[10px] text-muted-foreground">{record.integrity.complete ? "Required stages present" : `Missing: ${record.integrity.missingStages.join(", ") || "timestamp or policy invariant"}`} · {record.integrity.eventCount} events</p><p className="mt-2 text-[10px] text-muted-foreground">Execution eligible: No · Approved notional: 0</p></div>
      </article>)}
    </div>
    <p className="mt-4 text-[11px] leading-5 text-muted-foreground">Research-only snapshots. Run identifiers are correlation labels, not cryptographic hashes. No broker, exchange, wallet, order, or persistent audit store is connected.</p>
  </section>;
}
