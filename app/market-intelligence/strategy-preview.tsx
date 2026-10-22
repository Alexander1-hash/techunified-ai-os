"use client";

import { useEffect, useState } from "react";
import { BrainCircuit, LockKeyhole, RefreshCw, ShieldAlert } from "lucide-react";
import type { StrategyEvaluation } from "@/lib/market-intelligence/strategy-engine";
import type { QuoteEnvelope } from "@/lib/market-intelligence/market-data";
import { evaluateQuoteEnvelope } from "@/lib/market-intelligence/strategy-engine";

export default function StrategyPreview() {
  const [result, setResult] = useState<StrategyEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function evaluate() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/market-intelligence/quotes", { cache: "no-store" });
      if (!response.ok) throw new Error(`Market data endpoint returned HTTP ${response.status}`);
      const envelope = await response.json() as QuoteEnvelope;
      setResult(evaluateQuoteEnvelope(envelope));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to evaluate strategy preview.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void evaluate(); }, []);

  return <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-sky-600"><BrainCircuit size={12}/> Rule-based research</div>
        <h2 className="mt-3 text-lg font-semibold">Strategy Engine · v1.0.0</h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">A deterministic baseline translates reported 24-hour change into an explainable directional observation. It is not a prediction, investment recommendation, or proven edge.</p>
      </div>
      <button type="button" onClick={() => void evaluate()} disabled={loading} className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-background disabled:opacity-50"><RefreshCw size={13} className={loading ? "animate-spin" : ""}/>{loading ? "Evaluating…" : "Re-evaluate"}</button>
    </div>
    {error ? <p role="alert" className="mt-4 rounded-lg border border-rose-500/30 p-3 text-xs text-rose-500">{error}</p> : null}
    <div className="mt-4 grid gap-3 md:grid-cols-3">
      {(result?.signals ?? []).map(signal => <article key={signal.symbol} className="rounded-xl border border-border bg-background p-4">
        <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">{signal.symbol}</span><span className={`rounded-full border px-2 py-1 text-[9px] uppercase ${signal.direction === "bullish" ? "border-emerald-500/30 text-emerald-600" : signal.direction === "bearish" ? "border-rose-500/30 text-rose-600" : "border-border text-muted-foreground"}`}>{signal.direction}</span></div>
        <p className="mt-3 text-xs font-medium">Observation strength: {(signal.confidence * 100).toFixed(0)}%</p>
        <p className="mt-1 text-[10px] text-muted-foreground">Not a probability of profit or win rate.</p>
        <ul className="mt-3 space-y-2">{signal.rationale.map((reason, index) => <li key={index} className="text-[11px] leading-5 text-muted-foreground">• {reason}</li>)}</ul>
        <div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full border border-border px-2 py-1 text-[9px] text-muted-foreground">{signal.source}</span><span className="rounded-full border border-amber-500/30 px-2 py-1 text-[9px] text-amber-600">{signal.gate}</span></div>
      </article>)}
      {!result && !error ? <div className="md:col-span-3 rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">{loading ? "Evaluating quote observations…" : "No strategy output yet."}</div> : null}
    </div>
    <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <p className="flex items-center gap-2 text-xs font-semibold"><ShieldAlert size={14}/> Safety and validation status</p>
      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{result?.summary ?? "Waiting for evaluation."} Inputs are currently scripted demo quotes. Signals are blocked from execution; no orders, wallet, broker, or exchange API is called.</p>
      <p className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground"><LockKeyhole size={12}/> eligibleForExecution = false · backtesting and risk gates are not yet implemented</p>
    </div>
  </section>;
}
