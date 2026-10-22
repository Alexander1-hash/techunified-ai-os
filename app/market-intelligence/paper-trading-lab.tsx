"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CircleAlert, Play, RotateCcw, ShieldCheck, Square, TrendingUp } from "lucide-react";

type Direction = "LONG" | "SHORT";
type Position = { direction: Direction; entry: number; notional: number; openedAt: string };
type ClosedTrade = { id: number; direction: Direction; entry: number; exit: number; pnl: number; closedAt: string };

const STARTING_BALANCE = 10_000;
const DEMO_START_PRICE = 67_420;
const PAPER_ORDER_NOTIONAL = 250;
const MAX_POSITION_PERCENT = 5;
const MARKET_STEPS = [0.004, -0.006, 0.008, -0.003, 0.002, -0.007, 0.005];

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function timestamp() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function PaperTradingLab() {
  const [quote, setQuote] = useState(DEMO_START_PRICE);
  const [tick, setTick] = useState(0);
  const [realizedPnl, setRealizedPnl] = useState(0);
  const [position, setPosition] = useState<Position | null>(null);
  const [history, setHistory] = useState<ClosedTrade[]>([]);
  const [message, setMessage] = useState("Demo environment ready. No exchange is connected.");
  const balance = STARTING_BALANCE + realizedPnl;
  const maxNotional = balance * MAX_POSITION_PERCENT / 100;
  const unrealizedPnl = useMemo(() => {
    if (!position) return 0;
    const units = position.notional / position.entry;
    const sign = position.direction === "LONG" ? 1 : -1;
    return sign * units * (quote - position.entry);
  }, [position, quote]);
  const equity = balance + unrealizedPnl;

  function openPosition(direction: Direction) {
    if (position) {
      setMessage("Close the current simulated position before opening another.");
      return;
    }
    if (PAPER_ORDER_NOTIONAL > maxNotional) {
      setMessage("Risk guard blocked this paper order: it exceeds the 5% notional limit.");
      return;
    }
    setPosition({ direction, entry: quote, notional: PAPER_ORDER_NOTIONAL, openedAt: timestamp() });
    setMessage(`${direction} paper position opened at ${money(quote)}. This is simulated only.`);
  }

  function advanceMarket() {
    const move = MARKET_STEPS[tick % MARKET_STEPS.length];
    const next = Number((quote * (1 + move)).toFixed(2));
    setQuote(next);
    setTick((value) => value + 1);
    setMessage(`Demo quote moved ${move >= 0 ? "+" : ""}${(move * 100).toFixed(2)}%. This is a scripted scenario, not live market data.`);
  }

  function closePosition() {
    if (!position) return;
    const units = position.notional / position.entry;
    const sign = position.direction === "LONG" ? 1 : -1;
    const pnl = sign * units * (quote - position.entry);
    const trade: ClosedTrade = { id: Date.now(), direction: position.direction, entry: position.entry, exit: quote, pnl, closedAt: timestamp() };
    setHistory((items) => [trade, ...items].slice(0, 8));
    setRealizedPnl((value) => value + pnl);
    setPosition(null);
    setMessage(`Paper position closed. Simulated result: ${pnl >= 0 ? "+" : ""}${money(pnl)} before hypothetical fees.`);
  }

  function resetLab() {
    setQuote(DEMO_START_PRICE);
    setTick(0);
    setRealizedPnl(0);
    setPosition(null);
    setHistory([]);
    setMessage("Demo reset. All figures are simulated and have no cash value.");
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-amber-600"><CircleAlert size={12} /> Simulation only</div>
          <h2 className="mt-3 text-lg font-semibold">Paper Trading Lab</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Practice position management and inspect P&amp;L calculations before any exchange integration. Scripted demo quotes only; no live prices, broker connection, wallet, or real orders.</p>
        </div>
        <button type="button" onClick={resetLab} className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-background"><RotateCcw size={13} /> Reset demo</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-background p-4"><p className="text-[11px] text-muted-foreground">Demo BTC quote</p><p className="mt-2 text-xl font-semibold tracking-tight">{money(quote)}</p><p className="mt-1 text-[10px] text-muted-foreground">Scripted scenario · not live</p></div>
        <div className="rounded-xl border border-border bg-background p-4"><p className="text-[11px] text-muted-foreground">Simulated balance</p><p className="mt-2 text-xl font-semibold tracking-tight">{money(balance)}</p><p className="mt-1 text-[10px] text-muted-foreground">Starts at {money(STARTING_BALANCE)}</p></div>
        <div className="rounded-xl border border-border bg-background p-4"><p className="text-[11px] text-muted-foreground">Unrealized P&amp;L</p><p className={`mt-2 text-xl font-semibold tracking-tight ${unrealizedPnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{unrealizedPnl >= 0 ? "+" : ""}{money(unrealizedPnl)}</p><p className="mt-1 text-[10px] text-muted-foreground">{position ? `${position.direction} · ${money(position.notional)} notional` : "No open position"}</p></div>
        <div className="rounded-xl border border-border bg-background p-4"><p className="text-[11px] text-muted-foreground">Simulated equity</p><p className="mt-2 text-xl font-semibold tracking-tight">{money(equity)}</p><p className="mt-1 text-[10px] text-muted-foreground">Balance + unrealized P&amp;L</p></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-border p-4">
          <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">Practice controls</p><p className="mt-1 text-[11px] text-muted-foreground">Fixed paper order: {money(PAPER_ORDER_NOTIONAL)}</p></div><span className="rounded-full border border-border px-2 py-1 text-[10px] text-muted-foreground">Tick {tick}</span></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button type="button" disabled={!!position} onClick={() => openPosition("LONG")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"><ArrowUpRight size={16} /> Open simulated long</button>
            <button type="button" disabled={!!position} onClick={() => openPosition("SHORT")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-3 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"><ArrowDownRight size={16} /> Open simulated short</button>
            <button type="button" onClick={advanceMarket} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-3 text-sm font-medium hover:bg-background"><TrendingUp size={15} /> Advance demo market</button>
            <button type="button" disabled={!position} onClick={closePosition} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-3 text-sm font-medium hover:bg-background disabled:cursor-not-allowed disabled:opacity-40"><Square size={13} /> Close paper position</button>
          </div>
          <div className="mt-4 rounded-lg border border-border bg-background p-3 text-xs leading-5 text-muted-foreground" role="status">{message}</div>
        </div>

        <div className="rounded-xl border border-border p-4">
          <div className="flex items-center gap-2"><ShieldCheck size={16} /><h3 className="text-sm font-semibold">Risk guardrails</h3></div>
          <div className="mt-3 space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Maximum position notional</span><strong>{MAX_POSITION_PERCENT}% of balance</strong></div>
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, (PAPER_ORDER_NOTIONAL / Math.max(maxNotional, 1)) * 100)}%` }} /></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Order notional</span><strong>{money(PAPER_ORDER_NOTIONAL)}</strong></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Allowed notional at current balance</span><strong>{money(maxNotional)}</strong></div>
            <p className="border-t border-border pt-3 leading-5 text-muted-foreground">This is a learning guardrail, not a validated risk model. It does not model slippage, fees, funding, leverage, or real execution.</p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="border-b border-border p-4"><h3 className="text-sm font-semibold">Closed paper trades</h3><p className="mt-1 text-[11px] text-muted-foreground">Local session history; it is not persisted or independently verified.</p></div>
        {history.length === 0 ? <div className="p-6 text-center text-xs text-muted-foreground">No closed trades yet. Open a simulated position, advance the demo market, then close it.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead className="bg-background text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Side</th><th className="px-4 py-3 font-medium">Entry</th><th className="px-4 py-3 font-medium">Exit</th><th className="px-4 py-3 font-medium">P&amp;L</th><th className="px-4 py-3 font-medium">Closed</th></tr></thead><tbody>{history.map((trade) => <tr key={trade.id} className="border-t border-border"><td className="px-4 py-3 font-medium">{trade.direction}</td><td className="px-4 py-3">{money(trade.entry)}</td><td className="px-4 py-3">{money(trade.exit)}</td><td className={`px-4 py-3 font-semibold ${trade.pnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{trade.pnl >= 0 ? "+" : ""}{money(trade.pnl)}</td><td className="px-4 py-3 text-muted-foreground">{trade.closedAt}</td></tr>)}</tbody></table></div>}
      </div>
      <p className="text-[10px] leading-4 text-muted-foreground">Educational prototype only. It is not financial advice, does not forecast real prices, and must not be represented as evidence of trading profitability.</p>
    </section>
  );
}
