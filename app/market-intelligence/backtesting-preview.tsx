"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, FlaskConical, Play, ShieldCheck } from "lucide-react";
import { runBacktest, SYNTHETIC_SAMPLE_BARS, type BacktestResult } from "@/lib/market-intelligence/backtesting";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

export default function BacktestingPreview() {
  const [startingBalance, setStartingBalance] = useState("10000");
  const [positionNotional, setPositionNotional] = useState("500");
  const [feeBps, setFeeBps] = useState("5");
  const [lookback, setLookback] = useState("1");
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bars = useMemo(() => SYNTHETIC_SAMPLE_BARS, []);

  function run() {
    setError(null);
    try {
      setResult(runBacktest(bars, {
        startingBalance: Number(startingBalance),
        positionNotional: Number(positionNotional),
        feeBpsPerSide: Number(feeBps),
        lookbackBars: Number(lookback),
      }));
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : "Backtest could not run.");
    }
  }

  return <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-violet-600"><FlaskConical size={12}/> Historical replay sandbox</div>
        <h2 className="mt-3 text-lg font-semibold">Backtesting & Strategy Validation · v1.0.0</h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Run a repeatable rule-based replay over a small synthetic price series. This validates the mechanics of the simulator—not a real strategy or market edge.</p>
      </div>
      <span className="self-start rounded-full border border-amber-500/30 px-2.5 py-1 text-[10px] text-amber-600">Synthetic data only</span>
    </div>

    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-[11px] text-muted-foreground">Starting balance (USD)<input value={startingBalance} onChange={e => setStartingBalance(e.target.value)} inputMode="decimal" className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></label>
      <label className="text-[11px] text-muted-foreground">Position notional (USD)<input value={positionNotional} onChange={e => setPositionNotional(e.target.value)} inputMode="decimal" className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></label>
      <label className="text-[11px] text-muted-foreground">Fee per side (basis points)<input value={feeBps} onChange={e => setFeeBps(e.target.value)} inputMode="decimal" className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></label>
      <label className="text-[11px] text-muted-foreground">Lookback bars<input value={lookback} onChange={e => setLookback(e.target.value)} inputMode="numeric" className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></label>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button type="button" onClick={run} className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-xs font-medium text-background hover:opacity-90"><Play size={13}/> Run deterministic replay</button>
      <span className="text-[10px] text-muted-foreground">{bars.length} synthetic hourly bars · Jan 1, 2026 · no external feed</span>
    </div>
    {error ? <p role="alert" className="mt-4 rounded-lg border border-rose-500/30 p-3 text-xs text-rose-500">{error}</p> : null}

    {result ? <>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Ending balance", money(result.endingBalance)],
          ["Net P&L", money(result.netPnl)],
          ["Return", `${result.returnPercent.toFixed(2)}%`],
          ["Max drawdown", `${result.maxDrawdownPercent.toFixed(2)}%`],
          ["Closed trades", String(result.trades.length)],
          ["Win rate", `${result.winRatePercent.toFixed(1)}%`],
          ["Total fees", money(result.totalFees)],
          ["Profit factor", result.profitFactor === null ? "No gross losses" : result.profitFactor.toFixed(2)],
        ].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-background p-3"><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-1 text-base font-semibold">{value}</p></div>)}
      </div>

      <div className="mt-4 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between gap-2"><h3 className="text-xs font-semibold">Equity curve</h3><span className="text-[10px] text-muted-foreground">{result.barsProcessed} bars processed</span></div>
        <div className="mt-3 flex h-24 items-end gap-1" aria-label="Equity curve bar visualization">
          {result.equityCurve.map((point, index) => {
            const min = Math.min(...result.equityCurve.map(p => p.equity));
            const max = Math.max(...result.equityCurve.map(p => p.equity));
            const height = max === min ? 50 : 15 + ((point.equity - min) / (max - min)) * 85;
            return <div key={point.timestamp} title={`${point.timestamp}: ${money(point.equity)}`} className="flex-1 rounded-t bg-violet-500/70" style={{ height: `${height}%` }} />;
          })}
        </div>
        <div className="mt-2 flex justify-between text-[9px] text-muted-foreground"><span>{result.equityCurve[0]?.timestamp}</span><span>{result.equityCurve[result.equityCurve.length - 1]?.timestamp}</span></div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border p-4"><h3 className="flex items-center gap-2 text-xs font-semibold"><ShieldCheck size={14}/> Assumptions</h3><ul className="mt-2 space-y-2">{result.assumptions.map(item => <li key={item} className="text-[10px] leading-4 text-muted-foreground">• {item}</li>)}</ul></div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"><h3 className="flex items-center gap-2 text-xs font-semibold"><AlertTriangle size={14}/> Interpretation limits</h3><ul className="mt-2 space-y-2">{result.warnings.map(item => <li key={item} className="text-[10px] leading-4 text-muted-foreground">• {item}</li>)}</ul></div>
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[600px] text-left text-[10px]">
          <thead className="border-b border-border bg-background text-muted-foreground"><tr>{["Side", "Entry", "Exit", "Entry price", "Exit price", "Gross P&L", "Fees", "Net P&L"].map(label => <th key={label} className="px-3 py-2 font-medium">{label}</th>)}</tr></thead>
          <tbody>{result.trades.map((trade, index) => <tr key={`${trade.entryAt}-${index}`} className="border-b border-border last:border-0"><td className="px-3 py-2 uppercase">{trade.direction}</td><td className="px-3 py-2">{trade.entryAt.slice(11, 16)}</td><td className="px-3 py-2">{trade.exitAt.slice(11, 16)}</td><td className="px-3 py-2">{trade.entryPrice.toFixed(2)}</td><td className="px-3 py-2">{trade.exitPrice.toFixed(2)}</td><td className="px-3 py-2">{money(trade.grossPnl)}</td><td className="px-3 py-2">{money(trade.fees)}</td><td className="px-3 py-2">{money(trade.netPnl)}</td></tr>)}
          {!result.trades.length ? <tr><td colSpan={8} className="px-3 py-5 text-center text-muted-foreground">No completed trades for this configuration.</td></tr> : null}</tbody>
        </table>
      </div>
    </> : <div className="mt-5 rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">Run the replay to calculate metrics, trades, fees, drawdown, and equity curve.</div>}

    <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] leading-5 text-muted-foreground">Research-only. The sample is generated for software demonstration and is not actual BTC, crypto, forex, or securities history. No broker, exchange, wallet, or live execution system is connected.</div>
  </section>;
}
