export const CENTRAL_AUDIT_EVENT_TYPES = [
  "run.started",
  "run.completed",
  "run.failed",
  "incident.created",
  "incident.updated",
  "governance.decision",
  "snapshot.verified",
  "system.note",
] as const;

export const CENTRAL_AUDIT_SEVERITIES = ["info", "warning", "error", "critical"] as const;

export type CentralAuditEventType = (typeof CENTRAL_AUDIT_EVENT_TYPES)[number];
export type CentralAuditSeverity = (typeof CENTRAL_AUDIT_SEVERITIES)[number];

export type CentralAuditEventInput = {
  eventType: CentralAuditEventType;
  source: string;
  severity: CentralAuditSeverity;
  summary: string;
  details?: Record<string, unknown>;
  correlationId?: string;
};

export type CentralAuditEvent = CentralAuditEventInput & {
  id: string;
  user_id: string;
  created_at: string;
};

export const CENTRAL_AUDIT_LIMITS = {
  requestBytes: 16 * 1024,
  summaryLength: 500,
  sourceLength: 100,
  correlationIdLength: 120,
  detailsBytes: 4 * 1024,
  listLimit: 100,
} as const;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateCentralAuditInput(value: unknown):
  | { ok: true; value: CentralAuditEventInput }
  | { ok: false; error: string } {
  if (!isRecord(value)) return { ok: false, error: "Event body must be a JSON object." };
  if (!CENTRAL_AUDIT_EVENT_TYPES.includes(value.eventType as CentralAuditEventType)) {
    return { ok: false, error: "Unsupported audit event type." };
  }
  if (!CENTRAL_AUDIT_SEVERITIES.includes(value.severity as CentralAuditSeverity)) {
    return { ok: false, error: "Unsupported severity." };
  }
  if (typeof value.source !== "string" || !value.source.trim() || value.source.length > CENTRAL_AUDIT_LIMITS.sourceLength) {
    return { ok: false, error: "Source must be 1–100 characters." };
  }
  if (typeof value.summary !== "string" || !value.summary.trim() || value.summary.length > CENTRAL_AUDIT_LIMITS.summaryLength) {
    return { ok: false, error: "Summary must be 1–500 characters." };
  }
  if (value.correlationId !== undefined && (typeof value.correlationId !== "string" || value.correlationId.length > CENTRAL_AUDIT_LIMITS.correlationIdLength)) {
    return { ok: false, error: "Correlation ID is invalid or too long." };
  }
  const details = value.details === undefined ? {} : value.details;
  if (!isRecord(details)) return { ok: false, error: "Details must be a JSON object." };
  let detailsBytes = 0;
  try { detailsBytes = new TextEncoder().encode(JSON.stringify(details)).byteLength; }
  catch { return { ok: false, error: "Details must be serializable JSON." }; }
  if (detailsBytes > CENTRAL_AUDIT_LIMITS.detailsBytes) return { ok: false, error: "Details exceed the 4 KiB limit." };

  return {
    ok: true,
    value: {
      eventType: value.eventType as CentralAuditEventType,
      source: value.source.trim(),
      severity: value.severity as CentralAuditSeverity,
      summary: value.summary.trim(),
      details,
      ...(typeof value.correlationId === "string" && value.correlationId.trim()
        ? { correlationId: value.correlationId.trim() } : {}),
    },
  };
}
