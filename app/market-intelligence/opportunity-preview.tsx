"use client";

import { useMemo } from "react";
import { AlertTriangle, Radar, ShieldCheck } from "lucide-react";
import { getDemoQuoteEnvelope } from "@/lib/market-intelligence/market-data";
import { evaluateQuote } from "@/lib/market-intelligence/strategy-engine";
import { SYNTHETIC_SAMPLE_BARS } from "@/lib/market-intelligence/backtesting";
import { runWalkForwardValidation } from "@/lib/market-intelligence/strategy-validation";
import { detectOpportunity, OPPORTUNITY_BLOCKER_LABELS } from "@/lib/market-intelligence/opportunity-detection";

export default function OpportunityPreview() {
  const candidates = useMemo(() => {
    const envelope = getDemoQuoteEnvelope();
    const validation = runWalkForwardValidation(SYNTHETIC_SAMPLE_BARS, { startingBalance: 10000, positionNotional: 500, feeBpsPerSide: 5, candidateLookbacks: [1, 2], trainingBars: 6, validationBars: 4, stepBars: 2 });
    return envelope.quotes.map(quote => detectOpportunity(evaluateQuote(quote), validation));
  }, []);
  return <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div>
      <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-violet-600"><Radar size={12}/> Opportunity detection</div>
      <h2 className="mt-3 text-lg font-semibold">Opportunity Detection Engine · v1.0.0</h2>
      <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Evidence-gated triage combines signal direction, data provenance, quote freshness, and walk-forward validation. Score means evidence completeness, not probability of profit.</p>
    </div><span className="self-start rounded-full border border-amber-500/30 px-2.5 py-1 text-[10px] text-amber-600">Demo input · execution blocked</span></div>
    <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"><h3 className="flex items-center gap-2 text-xs font-semibold"><AlertTriangle size={14}/> Current feed cannot produce actionable opportunities</h3><p className="mt-2 text-[11px] leading-5 text-muted-foreground">This preview uses scripted quotes and synthetic validation bars. Candidates remain blocked until trustworthy live data and sufficient out-of-sample evidence exist.</p></div>
    <div className="mt-4 grid gap-3 lg:grid-cols-3">{candidates.map(candidate => <article key={candidate.symbol} className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-2"><div><h3 className="text-sm font-semibold">{candidate.symbol}</h3><p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{candidate.direction} · {candidate.source}</p></div><span className="rounded-full border border-rose-500/30 bg-rose-500/5 px-2 py-1 text-[10px] text-rose-600">{candidate.state}</span></div>
      <div className="mt-4 flex items-end justify-between"><div><p className="text-[10px] text-muted-foreground">Evidence completeness</p><p className="mt-1 text-xl font-semibold">{candidate.score}/100</p></div><div className="text-right"><p className="text-[10px] text-muted-foreground">Execution</p><p className="mt-1 text-xs font-medium">Disabled</p></div></div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-foreground/60" style={{ width: candidate.score + "%" }}/></div>
      <h4 className="mt-4 flex items-center gap-2 text-[11px] font-semibold"><ShieldCheck size={13}/> Blockers</h4><ul className="mt-2 space-y-2">{candidate.blockers.map(blocker => <li key={blocker} className="text-[10px] leading-4 text-muted-foreground">• {OPPORTUNITY_BLOCKER_LABELS[blocker]}</li>)}</ul>
    </article>)}</div>
    <div className="mt-4 text-[11px] leading-5 text-muted-foreground">Research-only · no broker, exchange, wallet, or order connection. Candidate status never authorizes capital deployment.</div>
  </section>;
}