import { Activity, BarChart3, BrainCircuit, FlaskConical, Gauge, Globe2, LineChart, LockKeyhole, PlayCircle, Radar, ShieldCheck, Sparkles, TrendingUp, WalletCards } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const modules: { title: string; description: string; icon: LucideIcon; status: string }[] = [
  { title: "Market Data", description: "Normalized prices, events, macro signals, and provider feeds.", icon: BarChart3, status: "Foundation" },
  { title: "Strategy Engine", description: "Explicit, testable strategy definitions and hypotheses.", icon: BrainCircuit, status: "Foundation" },
  { title: "Opportunity Detection", description: "Candidate opportunities from signals and strategy rules.", icon: Radar, status: "Planned" },
  { title: "Risk Engine", description: "Exposure, sizing, drawdown, liquidity, and policy constraints.", icon: ShieldCheck, status: "Planned" },
  { title: "Backtesting", description: "Reproducible historical replay and performance evidence.", icon: FlaskConical, status: "Planned" },
  { title: "Paper Trading", description: "Simulated execution before any live execution path.", icon: PlayCircle, status: "Planned" },
];

const integrations: { title: string; description: string; icon: LucideIcon }[] = [
  { title: "Polymarket Intelligence", description: "External prediction-market information.", icon: Globe2 },
  { title: "Deriv Intelligence", description: "Supported Deriv market data and intelligence feeds.", icon: LineChart },
  { title: "MT5 Integration", description: "Controlled boundary for market data and later execution.", icon: WalletCards },
];

const steps: { number: string; label: string; icon: LucideIcon }[] = [
  { number: "01", label: "Observe", icon: Activity },
  { number: "02", label: "Analyze", icon: BrainCircuit },
  { number: "03", label: "Test", icon: FlaskConical },
  { number: "04", label: "Validate", icon: ShieldCheck },
  { number: "05", label: "Act", icon: TrendingUp },
];

export default function MarketIntelligencePage() {
  return <div className="space-y-6">
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-[11px] text-muted-foreground"><Sparkles size={13}/> Intelligence layer</div>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Market Intelligence</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">A controlled market-intelligence environment connecting external information with strategy research, opportunity discovery, risk analysis, simulation, and explicitly authorized execution.</p>
    </section>

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {modules.map(({ title, description, icon: Icon, status }) => <article key={title} className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3"><div className="flex size-10 items-center justify-center rounded-xl border border-border bg-background"><Icon size={18}/></div><span className="rounded-full border border-border px-2 py-1 text-[10px] text-muted-foreground">{status}</span></div>
        <h2 className="mt-4 text-sm font-semibold">{title}</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
      </article>)}
    </section>

    <section className="rounded-2xl border border-border bg-card">
      <div className="border-b border-border p-5"><h2 className="text-base font-semibold">External intelligence boundaries</h2><p className="mt-1 text-xs text-muted-foreground">Provider integrations stay isolated so data can be validated before reaching strategy or action.</p></div>
      <div className="grid divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
        {integrations.map(({ title, description, icon: Icon }) => <div key={title} className="p-5"><div className="flex size-9 items-center justify-center rounded-lg border border-border bg-background"><Icon size={16}/></div><h3 className="mt-3 text-sm font-medium">{title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div>)}
      </div>
    </section>

    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3"><div className="flex size-9 items-center justify-center rounded-lg border border-border bg-background"><Gauge size={16}/></div><div><h2 className="text-sm font-semibold">Intelligence → verification → action</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">A detected opportunity does not become an order automatically.</p></div></div>
      <div className="mt-5 grid gap-2 sm:grid-cols-5">
        {steps.map(({ number, label, icon: Icon }) => <div key={number} className="flex items-center gap-2 rounded-xl border border-border bg-background p-3"><span className="text-[10px] text-muted-foreground">{number}</span><Icon size={14}/><span className="text-xs font-medium">{label}</span></div>)}
      </div>
      <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground"><LockKeyhole size={13}/> Controlled execution boundary</div>
    </section>
  </div>;
}
