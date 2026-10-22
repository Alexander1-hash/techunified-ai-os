"use client";

import { useMemo, useState } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { assessRisk } from "@/lib/market-intelligence/risk-engine";

const fieldClass = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const initial = {
  accountEquity: "10000",
  currentEquity: "9500",
  peakEquity: "10000",
  existingExposure: "1500",
  openPositions: "1",
  entryPrice: "100",
  stopPrice: "95",
  proposedNotional: "500",
  maxRiskPerTradePercent: "1",
  maxExposurePercent: "25",
  maxDrawdownPercent: "10",
  maxOpenPositions: "3",
};

export default function RiskPreview() {
  const [values, setValues] = useState(initial);
  const number = (key: keyof typeof initial) => Number(values[key]);
  const assessment = useMemo(() => assessRisk({
    accountEquity: number("accountEquity"),
    currentEquity: number("currentEquity"),
    peakEquity: number("peakEquity"),
    existingExposure: number("existingExposure"),
    openPositions: number("openPositions"),
    entryPrice: number("entryPrice"),
    stopPrice: number("stopPrice"),
    proposedNotional: number("proposedNotional"),
    policy: {
      maxRiskPerTradePercent: number("maxRiskPerTradePercent"),
      maxExposurePercent: number("maxExposurePercent"),
      maxDrawdownPercent: number("maxDrawdownPercent"),
      maxOpenPositions: number("maxOpenPositions"),
    },
  }), [values]);

  const fields: { key: keyof typeof initial; label: string; min?: number; max?: number; step?: string }[] = [
    { key: "accountEquity", label: "Starting account equity", min: 0, step: "any" },
    { key: "currentEquity", label: "Current equity", min: 0, step: "any" },
    { key: "peakEquity", label: "Peak equity", min: 0, step: "any" },
    { key: "existingExposure", label: "Existing exposure", min: 0, step: "any" },
    { key: "openPositions", label: "Current open positions", min: 0, step: "1" },
    { key: "entryPrice", label: "Hypothetical entry price", min: 0, step: "any" },
    { key: "stopPrice", label: "Hypothetical stop price", min: 0, step: "any" },
    { key: "proposedNotional", label: "Proposed notional", min: 0, step: "any" },
    { key: "maxRiskPerTradePercent", label: "Max risk per trade (%)", min: 0.01, max: 100, step: "0.1" },
    { key: "maxExposurePercent", label: "Max exposure (%)", min: 0.01, max: 100, step: "1" },
    { key: "maxDrawdownPercent", label: "Max drawdown (%)", min: 0.01, max: 100, step: "1" },
    { key: "maxOpenPositions", label: "Max open positions", min: 1, step: "1" },
  ];

  return <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
    <div className="flex items-start gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background"><ShieldCheck size={18}/></div>
      <div><h2 className="text-lg font-semibold">Risk Engine · Research Sandbox</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Adjust hypothetical portfolio inputs to inspect hard risk checks. These calculations are illustrative and are not connected to the paper-trading simulator or a broker.</p></div>
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(({ key, label, min, max, step }) => <label key={key} className="text-[11px] font-medium text-muted-foreground">{label}<input className={fieldClass} type="number" inputMode="decimal" min={min} max={max} step={step ?? "any"} value={values[key]} onChange={(event) => setValues(current => ({ ...current, [key]: event.target.value }))}/></label>)}
        <button type="button" onClick={() => setValues(initial)} className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-background sm:col-span-2">Reset example values</button>
      </div>
      <div className="space-y-3">
        <div className={`rounded-xl border p-4 ${assessment.status === "blocked" ? "border-rose-500/30 bg-rose-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
          <p className="flex items-center gap-2 text-xs font-semibold">{assessment.status === "blocked" ? <ShieldAlert size={15}/> : <ShieldCheck size={15}/>} {assessment.status === "blocked" ? "Risk checks blocked" : "Checks passed · manual review only"}</p>
          <p className="mt-2 text-[11px] leading-5 text-muted-foreground">Approved notional: <strong>0</strong> — this engine never authorizes trades.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Risk budget" value={assessment.riskBudget}/>
          <Metric label="Estimated loss at stop" value={assessment.estimatedLossAtStop}/>
          <Metric label="Projected exposure" value={assessment.projectedExposurePercent} suffix="%"/>
          <Metric label="Current drawdown" value={assessment.currentDrawdownPercent} suffix="%"/>
        </div>
        <div className="rounded-xl border border-border p-4"><h3 className="text-xs font-semibold">Policy checks</h3><ul className="mt-3 space-y-3">{assessment.checks.map(check => <li key={check.id} className="flex items-start gap-2"><span className={`mt-0.5 size-2 shrink-0 rounded-full ${check.passed ? "bg-emerald-500" : "bg-rose-500"}`}/><div><p className="text-[11px] font-medium">{check.label}</p><p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{check.detail}</p></div></li>)}</ul></div>
      </div>
    </div>
    <p className="mt-4 rounded-lg border border-border p-3 text-[10px] leading-5 text-muted-foreground">{assessment.disclaimer}</p>
  </section>;
}

function Metric({ label, value, suffix = "" }: { label: string; value: number | null; suffix?: string }) {
  return <div className="rounded-xl border border-border bg-background p-3"><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-2 text-sm font-semibold">{value === null || !Number.isFinite(value) ? "—" : value.toLocaleString(undefined, { maximumFractionDigits: 2 }) + suffix}</p></div>;
}
