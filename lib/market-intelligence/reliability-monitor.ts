import type { QuoteEnvelope, NormalizedQuote } from "./market-data";
import type { IntelligenceAuditRecord, IntelligenceStage } from "./orchestration-audit";

export type ReliabilitySeverity = "critical" | "high" | "medium" | "low";
export type ReliabilityIssue = {
  code: string;
  severity: ReliabilitySeverity;
  area: "market-data" | "audit" | "governance";
  message: string;
  reference: string;
};
export type ReliabilityReport = {
  schemaVersion: 1;
  generatedAt: string;
  healthScore: number;
  healthStatus: "healthy" | "degraded" | "unhealthy" | "no-data";
  quoteCount: number;
  quoteChecksPassed: number;
  auditCount: number;
  auditChecksPassed: number;
  issueCounts: Record<ReliabilitySeverity, number>;
  issues: ReliabilityIssue[];
  limitations: string[];
};

const REQUIRED_STAGES: IntelligenceStage[] = [
  "market-data", "strategy", "opportunity", "validation", "risk", "governance",
];
const WEIGHT: Record<ReliabilitySeverity, number> = { critical: 30, high: 15, medium: 7, low: 2 };

function issue(code: string, severity: ReliabilitySeverity, area: ReliabilityIssue["area"], message: string, reference: string): ReliabilityIssue {
  return { code, severity, area, message, reference };
}

function inspectQuote(quote: NormalizedQuote, nowMs: number): ReliabilityIssue[] {
  const issues: ReliabilityIssue[] = [];
  const ref = typeof quote?.symbol === "string" ? quote.symbol : "unknown";
  if (!quote || typeof quote !== "object") return [issue("quote.invalid_record", "critical", "market-data", "Quote is not an object.", ref)];
  if (!/^[A-Z0-9]{2,15}-[A-Z0-9]{2,15}$/.test(quote.symbol)) issues.push(issue("quote.invalid_symbol", "high", "market-data", "Symbol does not match BASE-QUOTE format.", ref));
  if (!Number.isFinite(quote.price) || quote.price <= 0) issues.push(issue("quote.invalid_price", "critical", "market-data", "Price must be finite and greater than zero.", ref));
  if (quote.changePercent24h !== null && !Number.isFinite(quote.changePercent24h)) issues.push(issue("quote.invalid_change", "high", "market-data", "24-hour change must be finite or null.", ref));
  const observed = Date.parse(quote.observedAt);
  const received = Date.parse(quote.receivedAt);
  if (!Number.isFinite(observed)) issues.push(issue("quote.invalid_observed_at", "high", "market-data", "Observation timestamp is invalid.", ref));
  else if (observed > nowMs + 60_000) issues.push(issue("quote.future_observation", "high", "market-data", "Observation timestamp is more than one minute in the future.", ref));
  if (!Number.isFinite(received)) issues.push(issue("quote.invalid_received_at", "high", "market-data", "Receipt timestamp is invalid.", ref));
  else if (received > nowMs + 60_000) issues.push(issue("quote.future_receipt", "medium", "market-data", "Receipt timestamp is more than one minute in the future.", ref));
  if (Number.isFinite(observed) && Number.isFinite(received) && observed > received + 60_000) issues.push(issue("quote.clock_order", "medium", "market-data", "Observed time is materially later than receipt time.", ref));
  if (quote.source === "scripted-demo" && quote.status !== "simulated") issues.push(issue("quote.demo_status_mismatch", "high", "market-data", "Scripted demo quotes must be marked simulated.", ref));
  if (quote.source === "provider" && quote.status === "simulated") issues.push(issue("quote.provider_status_mismatch", "medium", "market-data", "Provider quote is marked simulated; check adapter mapping.", ref));
  if (quote.isTradable !== false) issues.push(issue("quote.tradability_invariant", "critical", "governance", "Quote violates the non-tradable market-data boundary.", ref));
  if (Number.isFinite(observed) && quote.source === "provider" && nowMs - observed > 5 * 60_000 && quote.status === "live") issues.push(issue("quote.stale_marked_live", "high", "market-data", "Provider quote is older than five minutes but marked live.", ref));
  if (quote.source === "scripted-demo") issues.push(issue("quote.demo_data", "low", "market-data", "Scripted demonstration data is not a live market feed.", ref));
  return issues;
}

function inspectAudit(record: IntelligenceAuditRecord): ReliabilityIssue[] {
  const issues: ReliabilityIssue[] = [];
  const ref = typeof record?.runId === "string" ? record.runId : "unknown-run";
  if (!record || typeof record !== "object") return [issue("audit.invalid_record", "critical", "audit", "Audit record is not an object.", ref)];
  if (!Number.isFinite(Date.parse(record.createdAt))) issues.push(issue("audit.invalid_timestamp", "high", "audit", "Audit creation timestamp is invalid.", ref));
  const seen = new Set<IntelligenceStage>();
  let previousIndex = -1;
  for (const stage of record.stages ?? []) {
    const index = REQUIRED_STAGES.indexOf(stage.stage);
    if (index < 0) issues.push(issue("audit.unknown_stage", "high", "audit", "Audit contains an unknown stage.", ref));
    else {
      if (seen.has(stage.stage)) issues.push(issue("audit.duplicate_stage", "high", "audit", `Stage ${stage.stage} appears more than once.`, ref));
      if (index < previousIndex) issues.push(issue("audit.stage_order", "medium", "audit", "Audit stages are not in the expected order.", ref));
      seen.add(stage.stage);
      previousIndex = index;
    }
    if (!["passed", "blocked", "incomplete", "research-only"].includes(stage.status)) issues.push(issue("audit.invalid_stage_status", "high", "audit", "Stage has an unsupported status.", ref));
  }
  for (const missing of REQUIRED_STAGES.filter(stage => !seen.has(stage))) issues.push(issue("audit.missing_stage", "high", "audit", `Required stage ${missing} is missing.`, ref));
  const sequences = (record.events ?? []).map(event => event.sequence);
  if (sequences.some((value, index) => value !== index + 1)) issues.push(issue("audit.event_sequence", "medium", "audit", "Audit event sequence is missing, duplicated, or out of order.", ref));
  if (record.integrity?.eventCount !== (record.events ?? []).length) issues.push(issue("audit.event_count_mismatch", "medium", "audit", "Stored event count does not match actual events.", ref));
  if (record.policy?.eligibleForExecution !== false || record.policy?.approvedNotional !== 0 || record.mode !== "research-only") {
    issues.push(issue("governance.execution_invariant", "critical", "governance", "Research-only execution invariant is not satisfied.", ref));
  }
  if (record.integrity?.complete && (REQUIRED_STAGES.some(stage => !seen.has(stage)) || record.policy?.eligibleForExecution !== false || record.policy?.approvedNotional !== 0)) {
    issues.push(issue("audit.false_completeness", "critical", "audit", "Record claims completeness despite missing stages or invalid policy invariants.", ref));
  }
  return issues;
}

export function buildReliabilityReport(
  envelope: QuoteEnvelope | null,
  records: IntelligenceAuditRecord[],
  generatedAt = new Date(),
): ReliabilityReport {
  const timestamp = Number.isFinite(generatedAt.getTime()) ? generatedAt : new Date();
  const allIssues: ReliabilityIssue[] = [];
  const quotes = envelope?.quotes ?? [];
  const quoteIssues = quotes.flatMap(quote => inspectQuote(quote, timestamp.getTime()));
  allIssues.push(...quoteIssues);
  if (!envelope) allIssues.push(issue("market_data.unavailable", "high", "market-data", "Quote envelope is unavailable; market-data checks could not run.", "quote-envelope"));
  else {
    if (envelope.schemaVersion !== 1) allIssues.push(issue("market_data.schema_version", "high", "market-data", "Unsupported quote-envelope schema version.", "quote-envelope"));
    if (envelope.dataMode !== "simulation") allIssues.push(issue("market_data.mode_mismatch", "critical", "market-data", "Expected explicit simulation mode for the currently configured feed.", "quote-envelope"));
    if (!Number.isFinite(Date.parse(envelope.generatedAt))) allIssues.push(issue("market_data.invalid_generated_at", "high", "market-data", "Envelope generation timestamp is invalid.", "quote-envelope"));
    if (quotes.length === 0) allIssues.push(issue("market_data.empty", "high", "market-data", "Quote envelope contains no quotes.", "quote-envelope"));
  }
  for (const record of records) allIssues.push(...inspectAudit(record));
  if (records.length === 0) allIssues.push(issue("audit.no_records", "low", "audit", "No browser-local audit records are available to inspect.", "run-ledger"));

  const issueCounts: Record<ReliabilitySeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const item of allIssues) issueCounts[item.severity] += 1;
  const penalty = allIssues.reduce((sum, item) => sum + WEIGHT[item.severity], 0);
  const healthScore = Math.max(0, Math.min(100, 100 - penalty));
  const healthStatus = quotes.length === 0 && records.length === 0 ? "no-data"
    : issueCounts.critical > 0 || healthScore < 50 ? "unhealthy"
    : issueCounts.high > 0 || healthScore < 85 ? "degraded" : "healthy";
  return {
    schemaVersion: 1,
    generatedAt: timestamp.toISOString(),
    healthScore,
    healthStatus,
    quoteCount: quotes.length,
    quoteChecksPassed: Math.max(0, quotes.length - new Set(quoteIssues.map(item => item.reference)).size),
    auditCount: records.length,
    auditChecksPassed: Math.max(0, records.length - new Set(allIssues.filter(item => item.area !== "market-data").map(item => item.reference)).size),
    issueCounts,
    issues: allIssues.sort((a, b) => WEIGHT[b.severity] - WEIGHT[a.severity] || a.code.localeCompare(b.code)).slice(0, 100),
    limitations: [
      "The bundled quote endpoint currently supplies scripted demonstration data, not live prices.",
      "Audit history is browser-local, editable, and not a tamper-proof server-side record.",
      "Health score is a transparent heuristic over detected issues, not a security certification or financial-performance measure.",
      "This monitor is read-only; no orders, capital, or external accounts are accessed.",
    ],
  };
}
