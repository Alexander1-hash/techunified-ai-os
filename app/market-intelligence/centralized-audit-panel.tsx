"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, Database, RefreshCw, Send, X } from "lucide-react";
import { CENTRAL_AUDIT_EVENT_TYPES, CENTRAL_AUDIT_SEVERITIES, type CentralAuditEventType, type CentralAuditSeverity } from "@/lib/market-intelligence/centralized-audit";

type AuditRow = {
  id: string;
  event_type: string;
  source: string;
  severity: string;
  summary: string;
  details: Record<string, unknown>;
  correlation_id: string | null;
  created_at: string;
};

export default function CentralizedAuditPanel() {
  const [events, setEvents] = useState<AuditRow[]>([]);
  const [eventType, setEventType] = useState<CentralAuditEventType>("system.note");
  const [severity, setSeverity] = useState<CentralAuditSeverity>("info");
  const [summary, setSummary] = useState("");
  const [correlationId, setCorrelationId] = useState("");
  const [filterCorrelationId, setFilterCorrelationId] = useState("");
  const [status, setStatus] = useState("Centralized storage has not been checked.");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (filter = filterCorrelationId.trim()) => {
    setBusy(true);
    setError(false);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (filter) params.set("correlationId", filter);
      const response = await fetch(`/api/market-intelligence/audit-events?${params.toString()}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? `Audit request failed (HTTP ${response.status}).`);
      setEvents(Array.isArray(body.events) ? body.events : []);
      setStatus(`Connected to Supabase audit storage. Showing ${Array.isArray(body.events) ? body.events.length : 0} event(s)${filter ? ` for correlation ID “${filter}”` : " for this signed-in user"}.`);
    } catch (e) {
      setEvents([]);
      setError(true);
      setStatus(e instanceof Error ? e.message : "Audit storage is unavailable.");
    } finally { setBusy(false); }
  }, [filterCorrelationId]);

  useEffect(() => { void refresh(""); }, [refresh]);

  async function appendEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!summary.trim()) return;
    setBusy(true);
    setError(false);
    try {
      const response = await fetch("/api/market-intelligence/audit-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType, severity, summary: summary.trim(),
          source: "intelligence-operations-center",
          details: { origin: "operations-center-ui" },
          ...(correlationId.trim() ? { correlationId: correlationId.trim() } : {}),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? `Could not save event (HTTP ${response.status}).`);
      setSummary("");
      setFilterCorrelationId(correlationId.trim());
      setStatus("Event persisted in Supabase for the signed-in user.");
      await refresh(correlationId.trim());
    } catch (e) {
      setError(true);
      setStatus(e instanceof Error ? e.message : "Could not persist audit event.");
    } finally { setBusy(false); }
  }

  function clearFilter() {
    setFilterCorrelationId("");
    void refresh("");
  }

  return <section className="mt-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-indigo-700"><Database size={13}/> Centralized event store</div>
        <h3 className="mt-2 text-base font-semibold">Persistent audit events & incident timeline</h3>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Authenticated Supabase records scoped to your account. Reuse one correlation ID across detection, investigation, mitigation, and resolution events. Browser-local research history remains separate.</p>
      </div>
      <button type="button" onClick={() => void refresh()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-50"><RefreshCw size={13} className={busy ? "animate-spin" : ""}/> Refresh</button>
    </div>
    <form onSubmit={appendEvent} className="mt-4 grid gap-3 md:grid-cols-[1fr_130px_2fr]">
      <label className="text-[11px] text-muted-foreground">Event type<select value={eventType} onChange={e => setEventType(e.target.value as CentralAuditEventType)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground">{CENTRAL_AUDIT_EVENT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
      <label className="text-[11px] text-muted-foreground">Severity<select value={severity} onChange={e => setSeverity(e.target.value as CentralAuditSeverity)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground">{CENTRAL_AUDIT_SEVERITIES.map(level => <option key={level} value={level}>{level}</option>)}</select></label>
      <label className="text-[11px] text-muted-foreground">Event summary<input value={summary} onChange={e => setSummary(e.target.value)} maxLength={500} minLength={1} required placeholder="Describe the operational event" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"/></label>
      <label className="text-[11px] text-muted-foreground md:col-span-2">Correlation ID (optional)<input value={correlationId} onChange={e => setCorrelationId(e.target.value)} maxLength={120} placeholder="incident-2026-10-22-ops-01" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"/><span className="mt-1 block text-[10px]">Use the same ID for every event belonging to one incident.</span></label>
      <button disabled={busy || !summary.trim()} type="submit" className="inline-flex items-center justify-center gap-2 self-end rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"><Send size={13}/> Save event</button>
    </form>
    <form onSubmit={e => { e.preventDefault(); void refresh(filterCorrelationId.trim()); }} className="mt-4 flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-end">
      <label className="flex-1 text-[11px] text-muted-foreground">Filter incident timeline by correlation ID<input value={filterCorrelationId} onChange={e => setFilterCorrelationId(e.target.value)} maxLength={120} placeholder="Enter an exact correlation ID" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"/></label>
      <button disabled={busy} type="submit" className="rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-50">Show timeline</button>
      <button disabled={busy || !filterCorrelationId} type="button" onClick={clearFilter} className="inline-flex items-center justify-center gap-1 rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-50"><X size={12}/> Clear</button>
    </form>
    <p role="status" aria-live="polite" className={`mt-3 flex items-start gap-2 text-[11px] ${error ? "text-rose-600" : "text-muted-foreground"}`}>{error ? <AlertCircle size={14} className="shrink-0"/> : <CheckCircle2 size={14} className="shrink-0"/>}{status}</p>
    <div className="mt-4 space-y-2">
      {events.map(event => <article key={event.id} className="flex flex-col justify-between gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-start">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold">{event.summary}</span><span className="rounded-full border border-border px-2 py-0.5 text-[9px]">{event.severity}</span></div><p className="mt-1 text-[10px] text-muted-foreground">{event.event_type} · {event.source}</p>{event.correlation_id && <button type="button" onClick={() => { setFilterCorrelationId(event.correlation_id ?? ""); void refresh(event.correlation_id ?? ""); }} className="mt-1 break-all text-left text-[10px] text-indigo-600 underline">Correlation: {event.correlation_id} · show related events</button>}</div>
        <time className="shrink-0 text-[10px] text-muted-foreground" dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time>
      </article>)}
      {!events.length && <p className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">No centralized events loaded. Sign in and apply the Supabase migrations if storage is not yet configured.</p>}
    </div>
    <p className="mt-3 text-[10px] leading-5 text-muted-foreground">This is a correlated event timeline, not automated alerting or incident remediation. User-scoped RLS restricts normal access, but privileged database administrators can still alter records; this is not a tamper-proof compliance ledger.</p>
  </section>;
}
