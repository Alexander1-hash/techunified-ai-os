"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Check, CircleAlert, Download, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import { readRunLedger } from "@/lib/market-intelligence/run-ledger";
import { buildReliabilityReport } from "@/lib/market-intelligence/reliability-monitor";
import {
  exportIncidentSnapshot, readIncidentSnapshot, synchronizeIncidents, updateIncidentStatus,
  type IncidentSnapshot, type IncidentStatus, type IntelligenceIncident,
} from "@/lib/market-intelligence/incident-management";
import type { QuoteEnvelope } from "@/lib/market-intelligence/market-data";

const severityStyle = {
  critical: "border-rose-500/40 bg-rose-500/10 text-rose-600",
  high: "border-orange-500/40 bg-orange-500/10 text-orange-700",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-700",
  low: "border-border bg-background text-muted-foreground",
};

function shortTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Unknown";
}

export default function IntelligenceIncidentManagementPreview() {
  const [snapshot, setSnapshot] = useState<IncidentSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Incident console is ready.");

  const refresh = useCallback(async () => {
    setLoading(true);
    const notes: string[] = [];
    let envelope: QuoteEnvelope | null = null;
    try {
      const response = await fetch("/api/market-intelligence/quotes", { cache: "no-store" });
      if (!response.ok) throw new Error(`Quote endpoint returned HTTP ${response.status}`);
      envelope = await response.json() as QuoteEnvelope;
    } catch (error) {
      notes.push(error instanceof Error ? error.message : "Quote endpoint unavailable.");
    }

    try {
      const records = readRunLedger(window.localStorage).records;
      const report = buildReliabilityReport(envelope, records);
      const next = synchronizeIncidents(window.localStorage, report);
      setSnapshot(next);
      setMessage(notes.length ? notes.join(" ") : "Health check completed and incident state synchronized locally.");
    } catch {
      setSnapshot(null);
      setMessage("Browser storage is unavailable. Incident state could not be saved.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try { setSnapshot(readIncidentSnapshot(window.localStorage)); } catch { setMessage("Browser storage is unavailable."); }
    void refresh();
  }, [refresh]);

  function setStatus(incident: IntelligenceIncident, status: IncidentStatus) {
    try {
      setSnapshot(updateIncidentStatus(window.localStorage, incident.id, status));
      setMessage(`Incident ${incident.code} marked ${status}. A new refresh may reopen it if the finding remains active.`);
    } catch {
      setMessage("Unable to update incident status in browser storage.");
    }
  }

  function exportReport() {
    if (!snapshot) return;
    const blob = new Blob([exportIncidentSnapshot(snapshot)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `techunified-incidents-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Incident snapshot exported as unsigned JSON.");
  }

  const incidents = snapshot?.incidents ?? [];
  const active = incidents.filter(item => item.status !== "resolved");
  const resolved = incidents.filter(item => item.status === "resolved");
  const latestTrend = snapshot?.trend.slice(-8) ?? [];

  return <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-violet-700"><CircleAlert size={12}/> Incident operations</div>
        <h2 className="mt-3 text-lg font-semibold">Intelligence Observability & Incident Management</h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Turns reliability findings into a small incident queue with acknowledgement, resolution, recurrence counts, and health-score history.</p>
      </div>
      <div className="flex flex-wrap gap-2 self-start">
        <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium disabled:opacity-50"><RefreshCw size={13} className={loading ? "animate-spin" : ""}/>{loading ? "Scanning…" : "Scan now"}</button>
        <button type="button" onClick={exportReport} disabled={!snapshot} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium disabled:opacity-40"><Download size={13}/> Export</button>
      </div>
    </div>

    <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <p className="text-xs font-semibold">Operational boundaries</p>
      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Incidents and trend points are stored in this browser only. A finding disappearing on a later scan is automatically marked resolved; if it returns, it reopens and its occurrence count increases. This is not a centralized alerting service, and no email/SMS notifications are configured.</p>
    </div>

    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article className="rounded-xl border border-border p-4"><p className="text-[10px] text-muted-foreground">Open / acknowledged</p><p className="mt-1 text-2xl font-semibold">{active.length}</p><p className="mt-1 text-[10px] text-muted-foreground">Requires review or already acknowledged</p></article>
      <article className="rounded-xl border border-border p-4"><p className="text-[10px] text-muted-foreground">Critical active</p><p className="mt-1 text-2xl font-semibold text-rose-600">{active.filter(item => item.severity === "critical").length}</p><p className="mt-1 text-[10px] text-muted-foreground">Highest priority findings</p></article>
      <article className="rounded-xl border border-border p-4"><p className="text-[10px] text-muted-foreground">Resolved</p><p className="mt-1 text-2xl font-semibold text-emerald-600">{resolved.length}</p><p className="mt-1 text-[10px] text-muted-foreground">No longer present in latest scan</p></article>
      <article className="rounded-xl border border-border p-4"><p className="text-[10px] text-muted-foreground">Health history</p><p className="mt-1 text-2xl font-semibold">{snapshot?.trend.length ?? 0}/{30}</p><p className="mt-1 text-[10px] text-muted-foreground">Recent browser-local checkpoints</p></article>
    </div>

    <div className="mt-4 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-3"><div><h3 className="text-xs font-semibold">Health score trend</h3><p className="mt-1 text-[10px] text-muted-foreground">Most recent eight scan checkpoints</p></div><Activity size={16}/></div>
      {latestTrend.length === 0 ? <p className="mt-3 text-xs text-muted-foreground">Run a scan to begin a local trend.</p> : <div className="mt-3 space-y-2">{latestTrend.map((point, index) => <div key={point.capturedAt} className="grid grid-cols-[100px_1fr_42px] items-center gap-3"><span className="text-[10px] text-muted-foreground">{shortTime(point.capturedAt)}</span><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-foreground/70" style={{ width: `${point.score}%` }}/></div><span className="text-right text-[10px] font-semibold">{point.score}</span><p className="col-span-3 -mt-1 text-[9px] text-muted-foreground">{point.status} · {point.openIncidents} active · {point.critical} critical · {point.high} high</p></div>)}</div>}
    </div>

    <div className="mt-4"><h3 className="text-xs font-semibold">Active incident queue</h3><p className="mt-1 text-[10px] text-muted-foreground">Acknowledging records ownership; resolving manually can be undone if the finding is still present on the next scan.</p></div>
    <div className="mt-3 space-y-2">
      {active.map(incident => <article key={incident.id} className="rounded-xl border border-border bg-background p-3">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold">{incident.code}</span><span className={`rounded-full border px-2 py-0.5 text-[9px] ${severityStyle[incident.severity]}`}>{incident.severity}</span><span className="rounded-full border border-border px-2 py-0.5 text-[9px] capitalize">{incident.status}</span></div><p className="mt-1 text-[11px] leading-5 text-muted-foreground">{incident.message}</p><p className="mt-1 break-all text-[10px] text-muted-foreground">{incident.reference} · {incident.area}</p><p className="mt-1 text-[10px] text-muted-foreground">First seen {shortTime(incident.firstSeenAt)} · Last seen {shortTime(incident.lastSeenAt)} · Seen {incident.occurrences} scan(s)</p></div>
          <div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={() => setStatus(incident, incident.status === "acknowledged" ? "open" : "acknowledged")} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-2 text-[10px]">{incident.status === "acknowledged" ? <RotateCcw size={12}/> : <Check size={12}/>} {incident.status === "acknowledged" ? "Reopen review" : "Acknowledge"}</button><button type="button" onClick={() => setStatus(incident, "resolved")} className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 px-2.5 py-2 text-[10px] text-emerald-700"><ShieldCheck size={12}/> Resolve</button></div>
        </div>
      </article>)}
      {active.length === 0 && <div className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">No active incidents in the latest saved snapshot.</div>}
    </div>

    {resolved.length > 0 && <details className="mt-4 rounded-xl border border-border p-4"><summary className="cursor-pointer text-xs font-semibold">Resolved incidents ({resolved.length})</summary><div className="mt-3 space-y-2">{resolved.slice(0, 10).map(item => <div key={item.id} className="rounded-lg border border-border p-3"><p className="text-xs font-medium">{item.code} <span className="ml-1 text-emerald-600">resolved</span></p><p className="mt-1 text-[10px] text-muted-foreground">{item.message}</p><p className="mt-1 text-[10px] text-muted-foreground">Occurrences: {item.occurrences} · Resolved {item.resolvedAt ? shortTime(item.resolvedAt) : "—"}</p></div>)}</div></details>}
    <p role="status" className="mt-3 text-[11px] text-muted-foreground">{message}</p>
  </section>;
}
