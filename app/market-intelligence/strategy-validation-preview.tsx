"use client";

import { useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, FlaskConical } from "lucide-react";
import { SYNTHETIC_SAMPLE_BARS } from "@/lib/market-intelligence/backtesting";
import { runWalkForwardValidation, type ValidationReport } from "@/lib/market-intelligence/strategy-validation";

export default function StrategyValidationPreview() {
  const [trainingBars, setTrainingBars] = useState("6");
  const [validationBars, setValidationBars] = useState("4");
  const [stepBars, setStepBars] = useState("2");
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    try {
      setReport(runWalkForwardValidation(SYNTHETIC_SAMPLE_BARS, {
        startingBalance: 10000,
        positionNotional: 500,
        feeBpsPerSide: 5,
        candidateLookbacks: [1, 2],
        trainingBars: Number(trainingBars),
        validationBars: Number(validationBars),
        stepBars: Number(stepBars),
      }));
    } catch (cause) {
      setReport(null);
      setError(cause instanceof Error ? cause.message : "Validation could not run.");
    }
  }

  return <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-cyan-600"><Activity size={12}/> Walk-forward validation</div>
        <h2 className="mt-3 text-lg font-semibold">Strategy Validation Framework · v1.0.0</h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Select a lookback on each training window, then evaluate it on a later holdout window. No parameter is selected using the holdout results.</p>
      </div>
      <span className="self-start rounded-full border border-amber-500/30 px-2.5 py-1 text-[10px] text-amber-600">Synthetic data only</span>
    </div>

    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      <label className="text-[11px] text-muted-foreground">Training bars<input value={trainingBars} onChange={e => setTrainingBars(e.target.value)} inputMode="numeric" className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></label>
      <label className="text-[11px] text-muted-foreground">Holdout validation bars<input value={validationBars} onChange={e => setValidationBars(e.target.value)} inputMode="numeric" className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></label>
      <label className="text-[11px] text-muted-foreground">Walk-forward step bars<input value={stepBars} onChange={e => setStepBars(e.target.value)} inputMode="numeric" className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></label>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button type="button" onClick={run} className="rounded-lg bg-foreground px-4 py-2.5 text-xs font-medium text-background hover:opacity-90">Run walk-forward validation</button>
      <span className="text-[10px] text-muted-foreground">Fixed candidates: lookback 1 and 2 · $10,000 balance · $500 notional · 5 bps per side</span>
    </div>
    {error ? <p role="alert" className="mt-4 rounded-lg border border-rose-500/30 p-3 text-xs text-rose-500">{error}</p> : null}

    {report ? <>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Validation folds", String(report.folds.length)],
          ["Average holdout return", `${report.averageValidationReturnPercent.toFixed(2)}%`],
          ["Positive holdout folds", `${report.positiveValidationFolds} / ${report.folds.length}`],
          ["Positive-fold ratio", `${report.stabilityPercent.toFixed(1)}%`],
        ].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-background p-3"><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-1 text-base font-semibold">{value}</p></div>)}
      </div>
      <div className={`mt-4 rounded-xl border p-4 ${report.status === "completed" ? "border-border" : "border-amber-500/30 bg-amber-500/5"}`}>
        <h3 className="flex items-center gap-2 text-xs font-semibold">{report.status === "completed" ? <CheckCircle2 size={14}/> : <AlertTriangle size={14}/>} {report.status === "completed" ? "Holdout report generated" : "More bars required"}</h3>
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{report.interpretation}</p>
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[760px] text-left text-[10px]">
          <thead className="border-b border-border bg-background text-muted-foreground"><tr>{["Fold", "Training window", "Holdout window", "Selected lookback", "Training return", "Holdout return", "Holdout trades", "Holdout drawdown"].map(label => <th key={label} className="px-3 py-2 font-medium">{label}</th>)}</tr></thead>
          <tbody>{report.folds.map(fold => <tr key={fold.fold} className="border-b border-border last:border-0"><td className="px-3 py-2">{fold.fold}</td><td className="px-3 py-2">{fold.trainingStart.slice(5, 16)} – {fold.trainingEnd.slice(5, 16)}</td><td className="px-3 py-2">{fold.validationStart.slice(5, 16)} – {fold.validationEnd.slice(5, 16)}</td><td className="px-3 py-2">{fold.selectedLookback}</td><td className="px-3 py-2">{fold.trainingReturnPercent.toFixed(2)}%</td><td className="px-3 py-2">{fold.validationReturnPercent.toFixed(2)}%</td><td className="px-3 py-2">{fold.validationTrades}</td><td className="px-3 py-2">{fold.validationMaxDrawdownPercent.toFixed(2)}%</td></tr>)}
          {!report.folds.length ? <tr><td colSpan={8} className="px-3 py-5 text-center text-muted-foreground">No complete folds for this window configuration.</td></tr> : null}</tbody>
        </table>
      </div>
      <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"><h3 className="flex items-center gap-2 text-xs font-semibold"><AlertTriangle size={14}/> Research caveats</h3><ul className="mt-2 space-y-2">{report.caveats.map(item => <li key={item} className="text-[10px] leading-4 text-muted-foreground">• {item}</li>)}</ul></div>
    </> : <div className="mt-5 rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground"><FlaskConical size={18} className="mx-auto mb-2"/>Run the validation to compare training-selected settings against later holdout windows.</div>}
    <div className="mt-4 text-[11px] leading-5 text-muted-foreground">Research-only · synthetic sample bars · no live market feed or execution connection. A positive holdout return on this tiny sample is not proof of a durable strategy edge.</div>
  </section>;
}
