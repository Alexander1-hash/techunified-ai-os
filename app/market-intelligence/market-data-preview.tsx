"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, RefreshCw } from "lucide-react";
import type { QuoteEnvelope } from "@/lib/market-intelligence/market-data";

function money(value: number, symbol: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: symbol, maximumFractionDigits: value >= 100 ? 2 : 4 }).format(value);
}

export default function MarketDataPreview() {
  const [payload, setPayload] = useState<QuoteEnvelope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/market-intelligence/quotes", { cache: "no-store" });
      if (!response.ok) throw new Error(`Quote endpoint returned HTTP ${response.status}`);
      const next = await response.json() as QuoteEnvelope;
      setPayload(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load the quote preview.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-amber-600"><AlertTriangle size={12}/> Simulation feed</div>
          <h2 className="mt-3 text-lg font-semibold">Normalized Market Data</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">A versioned quote schema and validation boundary are in place. The current endpoint intentionally serves scripted demo values; no provider is connected.</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-background disabled:opacity-50"><RefreshCw size={13} className={loading ? "animate-spin" : ""}/>{loading ? "Refreshing…" : "Refresh preview"}</button>
      </div>
      {error ? <p role="alert" className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-500">{error}</p> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {(payload?.quotes ?? []).map((quote) => (
          <article key={quote.symbol} className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">{quote.symbol}</span><span className="rounded-full border border-amber-500/30 px-2 py-1 text-[9px] text-amber-600">{quote.status}</span></div>
            <p className="mt-3 text-xl font-semibold tracking-tight">{money(quote.price, quote.quoteAsset)}</p>
            <p className={`mt-1 text-xs ${(quote.changePercent24h ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{quote.changePercent24h == null ? "Change unavailable" : `${quote.changePercent24h > 0 ? "+" : ""}${quote.changePercent24h.toFixed(2)}% · demo 24h change`}</p>
            <p className="mt-3 text-[10px] text-muted-foreground">Source: {quote.source} · non-tradable</p>
          </article>
        ))}
        {!payload && !error ? <div className="sm:col-span-3 rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground"><Activity size={16} className="mx-auto mb-2"/>{loading ? "Loading simulated quote envelope…" : "Quote preview is waiting to load."}</div> : null}
      </div>
      {payload ? <div className="mt-4 rounded-lg border border-border bg-background p-3 text-[11px] leading-5 text-muted-foreground"><strong className="text-foreground">Safety boundary:</strong> {payload.warnings.join(" ")} Schema v{payload.schemaVersion} · generated {new Date(payload.generatedAt).toLocaleTimeString()}.</div> : null}
    </section>
  );
}
