"use client";

import { useMemo } from "react";
import { AlertTriangle, ClipboardCheck, LockKeyhole, ShieldAlert } from "lucide-react";
import { getDemoQuoteEnvelope } from "@/lib/market-intelligence/market-data";
import { evaluateQuote } from "@/lib/market-intelligence/strategy-engine";
import { SYNTHETIC_SAMPLE_BARS } from "@/lib/market-intelligence/backtesting";
import { runWalkForwardValidation } from "@/lib/market-intelligence/strategy-validation";
import { detectOpportunity } from "@/lib/market-intelligence/opportunity-detection";
import { assessRisk } from "@/lib/market-intelligence/risk-engine";
import { evaluateDecisionGovernance, GOVERNANCE_REASON_LABELS } from "@/lib/market-intelligence/decision-governance";

export default function DecisionGovernancePreview() {
  const decisions = useMemo(() => {
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
      return evaluateDecisionGovernance({ signal, opportunity, risk, validation });
    });
  }, []);

  return <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-amber-700"><ClipboardCheck size={12}/> Decision governance</div>
        <h2 className="mt-3 text-lg font-semibold">Decision & Governance Engine · v1.0.0</h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">A fail-closed decision boundary aggregates strategy, opportunity, validation, and risk evidence. It reports policy blockers rather than trusting any single module.</p>
      </div>
      <span className="self-start rounded-full border border-rose-500/30 px-2.5 py-1 text-[10px] text-rose-600">No capital authorization</span>
    </div>

    <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <h3 className="flex items-center gap-2 text-xs font-semibold"><AlertTriangle size={14}/> Demonstration-only evidence</h3>
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">This view uses scripted demo quotes and synthetic validation bars. A governance outcome is not a trade recommendation, and passing checks cannot enable orders.</p>
    </div>

    <div className="mt-4 grid gap-3 lg:grid-cols-3">
      {decisions.map(decision => <article key={decision.symbol} className="rounded-xl border border-border bg-background p-4">
        <div className="flex items-start justify-between gap-2">
          <div><h3 className="text-sm font-semibold">{decision.symbol}</h3><p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{decision.evidence.signalDirection ?? "unknown"} · {decision.evidence.dataSource ?? "unknown"}</p></div>
          <span className="rounded-full border border-rose-500/30 bg-rose-500/5 px-2 py-1 text-[10px] text-rose-600">{decision.outcome}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border p-3"><p className="text-[10px] text-muted-foreground">Validation</p><p className="mt-1 text-xs font-medium">{decision.evidence.validationStatus ?? "missing"}</p></div>
          <div className="rounded-lg border border-border p-3"><p className="text-[10px] text-muted-foreground">Risk assessment</p><p className="mt-1 text-xs font-medium">{decision.evidence.riskStatus ?? "missing"}</p></div>
        </div>
        <h4 className="mt-4 flex items-center gap-2 text-[11px] font-semibold"><ShieldAlert size={13}/> Governance reasons</h4>
        <ul className="mt-2 space-y-2">{decision.reasons.map(reason => <li key={reason} className="text-[10px] leading-4 text-muted-foreground">• {GOVERNANCE_REASON_LABELS[reason]}</li>)}</ul>
        <div className="mt-4 rounded-lg border border-border p-3"><p className="text-[10px] text-muted-foreground">Approved notional</p><p className="mt-1 text-lg font-semibold">0</p><p className="mt-1 text-[10px] text-muted-foreground">{decision.summary}</p></div>
      </article>)}
    </div>
    <div className="mt-4 flex items-center gap-2 text-[11px] leading-5 text-muted-foreground"><LockKeyhole size={13}/> Fail-closed policy · human review is not authorization · live execution disabled.</div>
  </section>;
}
