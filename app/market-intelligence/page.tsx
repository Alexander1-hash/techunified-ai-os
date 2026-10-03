import { Activity, BarChart3, BrainCircuit, FlaskConical, Gauge, Globe2, LineChart, LockKeyhole, PlayCircle, Radar, ShieldCheck, Sparkles, TrendingUp, WalletCards } from "lucide-react";

const modules = [
  ["Market Data","Normalized prices, events, macro signals, and provider feeds.",BarChart3,"Foundation"],
  ["Strategy Engine","Explicit, testable strategy definitions and hypotheses.",BrainCircuit,"Foundation"],
  ["Opportunity Detection","Candidate opportunities from signals and strategy rules.",Radar,"Planned"],
  ["Risk Engine","Exposure, sizing, drawdown, liquidity, and policy constraints.",ShieldCheck,"Planned"],
  ["Backtesting","Reproducible historical replay and performance evidence.",FlaskConical,"Planned"],
  ["Paper Trading","Simulated execution before any live execution path.",PlayCircle,"Planned"],
] as const;

const integrations = [
  ["Polymarket Intelligence","External prediction-market information.",Globe2],
  ["Deriv Intelligence","Supported Deriv market data and intelligence feeds.",LineChart],
  ["MT5 Integration","Controlled boundary for market data and later execution.",WalletCards],
] as const;

export default function MarketIntelligencePage() {
  return <div className="space-y-6">
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-[11px] text-muted-foreground"><Sparkles size={13}/> Intelligence layer</div>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Market Intelligence</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">A controlled market-intelligence environment connecting external information with strategy research, opportunity discovery, risk analysis, simulation, and explicitly authorized execution.</p>
    </section>

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {modules.map(([title,description,Icon,status]) => <article key={title} className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3"><div className="flex size-10 items-center justify-center rounded-xl border border-border bg-background"><Icon size={18}/></div><span className="rounded-full border border-border px-2 py-1 text-[10px] text-muted-foreground">{status}</span></div>
        <h2 className="mt-4 text-sm font-semibold">{title}</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
      </article>)}
    </section>

    <section className="rounded-2xl border border-border bg-card">
      <div className="border-b border-border p-5"><h2 className="text-base font-semibold">External intelligence boundaries</h2><p className="mt-1 text-xs text-muted-foreground">Provider integrations stay isolated so data can be validated before reaching strategy or action.</p></div>
      <div className="grid divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
        {integrations.map(([title,description,Icon]) => <div key={title} className="p-5"><div className="flex size-9 items-center justify-center rounded-lg border border-border bg-background"><Icon size={16}/></div><h3 className="mt-3 text-sm font-medium">{title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div>)}
      </div>
    </section>

    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3"><div className="flex size-9 items-center justify-center rounded-lg border border-border bg-background"><Gauge size={16}/></div><div><h2 className="text-sm font-semibold">Intelligence → verification → action</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">A detected opportunity does not become an order automatically.</p></div></div>
      <div className="mt-5 grid gap-2 sm:grid-cols-5">
        {[["01","Observe",Activity],["02","Analyze",BrainCircuit],["03","Test",FlaskConical],["04","Validate",ShieldCheck],["05","Act",TrendingUp]].map(([n,label,Icon]) => <div key={String(n)} className="flex items-center gap-2 rounded-xl border border-border bg-background p-3"><span className="text-[10px] text-muted-foreground">{n}</span><Icon size={14}/><span className="text-xs font-medium">{String(label)}</span></div>)}
      </div>
      <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground"><LockKeyhole size={13}/> Controlled execution boundary</div>
    </section>
  </div>;
}
