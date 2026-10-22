import type { ReliabilityIssue, ReliabilityReport } from "./reliability-monitor";

export const INCIDENT_STORAGE_KEY = "techunified-ai-os:intelligence-incidents:v1";
export const INCIDENT_SCHEMA_VERSION = 1 as const;
export const INCIDENT_MAX_RECORDS = 200;
export const INCIDENT_MAX_TREND_POINTS = 30;

export type IncidentStatus = "open" | "acknowledged" | "resolved";
export type IntelligenceIncident = {
  id: string;
  code: string;
  severity: ReliabilityIssue["severity"];
  area: ReliabilityIssue["area"];
  message: string;
  reference: string;
  status: IncidentStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  occurrences: number;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
};
export type HealthTrendPoint = {
  capturedAt: string;
  score: number;
  status: ReliabilityReport["healthStatus"];
  openIncidents: number;
  critical: number;
  high: number;
};
export type IncidentSnapshot = {
  schemaVersion: typeof INCIDENT_SCHEMA_VERSION;
  updatedAt: string;
  incidents: IntelligenceIncident[];
  trend: HealthTrendPoint[];
};

function safeDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validIncident(value: unknown): value is IntelligenceIncident {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<IntelligenceIncident>;
  return typeof item.id === "string" && typeof item.code === "string"
    && ["critical", "high", "medium", "low"].includes(item.severity ?? "")
    && ["market-data", "audit", "governance"].includes(item.area ?? "")
    && ["open", "acknowledged", "resolved"].includes(item.status ?? "")
    && typeof item.message === "string" && typeof item.reference === "string"
    && safeDate(item.firstSeenAt) && safeDate(item.lastSeenAt)
    && Number.isInteger(item.occurrences) && (item.occurrences ?? 0) >= 1
    && (item.acknowledgedAt === null || safeDate(item.acknowledgedAt))
    && (item.resolvedAt === null || safeDate(item.resolvedAt));
}

function incidentId(item: Pick<ReliabilityIssue, "code" | "reference">) {
  return `${item.code}::${item.reference}`;
}

export function readIncidentSnapshot(storage: Pick<Storage, "getItem">): IncidentSnapshot {
  const fallback: IncidentSnapshot = { schemaVersion: 1, updatedAt: new Date(0).toISOString(), incidents: [], trend: [] };
  try {
    const raw = storage.getItem(INCIDENT_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return fallback;
    const candidate = parsed as Partial<IncidentSnapshot>;
    if (candidate.schemaVersion !== 1) return fallback;
    const trend = Array.isArray(candidate.trend) ? candidate.trend.filter((point): point is HealthTrendPoint => {
      if (!point || typeof point !== "object") return false;
      const p = point as Partial<HealthTrendPoint>;
      return safeDate(p.capturedAt) && Number.isFinite(p.score) && (p.score ?? -1) >= 0 && (p.score ?? 101) <= 100
        && ["healthy", "degraded", "unhealthy", "no-data"].includes(p.status ?? "")
        && Number.isInteger(p.openIncidents) && Number.isInteger(p.critical) && Number.isInteger(p.high);
    }).slice(-INCIDENT_MAX_TREND_POINTS) : [];
    const incidents = Array.isArray(candidate.incidents) ? candidate.incidents.filter(validIncident).slice(0, INCIDENT_MAX_RECORDS) : [];
    return {
      schemaVersion: 1,
      updatedAt: safeDate(candidate.updatedAt) ? candidate.updatedAt : new Date(0).toISOString(),
      incidents,
      trend,
    };
  } catch {
    return fallback;
  }
}

function persist(storage: Pick<Storage, "setItem">, snapshot: IncidentSnapshot) {
  storage.setItem(INCIDENT_STORAGE_KEY, JSON.stringify(snapshot));
}

export function synchronizeIncidents(
  storage: Pick<Storage, "getItem" | "setItem">,
  report: ReliabilityReport,
  now = new Date(),
): IncidentSnapshot {
  const current = readIncidentSnapshot(storage);
  const nowIso = Number.isFinite(now.getTime()) ? now.toISOString() : new Date().toISOString();
  const activeFindings = new Map<string, ReliabilityIssue>();
  for (const finding of report.issues) activeFindings.set(incidentId(finding), finding);
  const existing = new Map(current.incidents.map(item => [item.id, item]));
  const next: IntelligenceIncident[] = [];

  for (const [id, finding] of activeFindings) {
    const previous = existing.get(id);
    next.push({
      id, code: finding.code, severity: finding.severity, area: finding.area,
      message: finding.message, reference: finding.reference,
      status: previous?.status === "resolved" ? "open" : previous?.status ?? "open",
      firstSeenAt: previous?.firstSeenAt ?? nowIso,
      lastSeenAt: nowIso,
      occurrences: (previous?.occurrences ?? 0) + 1,
      acknowledgedAt: previous?.status === "resolved" ? null : previous?.acknowledgedAt ?? null,
      resolvedAt: null,
    });
  }

  for (const previous of current.incidents) {
    if (!activeFindings.has(previous.id)) {
      next.push(previous.status === "resolved" ? previous : {
        ...previous, status: "resolved", resolvedAt: nowIso,
      });
    }
  }

  next.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity] || Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt);
  });

  const open = next.filter(item => item.status !== "resolved");
  const point: HealthTrendPoint = {
    capturedAt: nowIso,
    score: report.healthScore,
    status: report.healthStatus,
    openIncidents: open.length,
    critical: open.filter(item => item.severity === "critical").length,
    high: open.filter(item => item.severity === "high").length,
  };
  const lastPoint = current.trend[current.trend.length - 1];
  const trend = lastPoint && Date.parse(nowIso) - Date.parse(lastPoint.capturedAt) < 60_000
    ? [...current.trend.slice(0, -1), point]
    : [...current.trend, point].slice(-INCIDENT_MAX_TREND_POINTS);
  const snapshot: IncidentSnapshot = {
    schemaVersion: 1,
    updatedAt: nowIso,
    incidents: next.slice(0, INCIDENT_MAX_RECORDS),
    trend,
  };
  persist(storage, snapshot);
  return snapshot;
}

export function updateIncidentStatus(
  storage: Pick<Storage, "getItem" | "setItem">,
  id: string,
  status: IncidentStatus,
  now = new Date(),
): IncidentSnapshot {
  const current = readIncidentSnapshot(storage);
  const timestamp = Number.isFinite(now.getTime()) ? now.toISOString() : new Date().toISOString();
  const incidents = current.incidents.map(item => {
    if (item.id !== id) return item;
    return {
      ...item,
      status,
      acknowledgedAt: status === "acknowledged" ? timestamp : status === "open" ? null : item.acknowledgedAt,
      resolvedAt: status === "resolved" ? timestamp : status === "open" || status === "acknowledged" ? null : item.resolvedAt,
    };
  });
  const snapshot = { ...current, updatedAt: timestamp, incidents };
  persist(storage, snapshot);
  return snapshot;
}

export function exportIncidentSnapshot(snapshot: IncidentSnapshot): string {
  return JSON.stringify({
    ...snapshot,
    export: {
      format: "techunified-ai-os-incident-report",
      exportedAt: new Date().toISOString(),
      storage: "browser-local",
      integrity: "Unsigned JSON; browser-local state is editable and not tamper-proof.",
    },
  }, null, 2);
}
