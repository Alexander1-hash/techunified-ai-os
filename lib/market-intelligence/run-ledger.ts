import type { IntelligenceAuditRecord } from "./orchestration-audit";

export const RUN_LEDGER_STORAGE_KEY = "techunified-ai-os:intelligence-run-ledger:v1";
export const RUN_LEDGER_SCHEMA_VERSION = 1 as const;
export const RUN_LEDGER_MAX_RECORDS = 100;

export type RunLedgerSnapshot = {
  schemaVersion: typeof RUN_LEDGER_SCHEMA_VERSION;
  updatedAt: string;
  records: IntelligenceAuditRecord[];
};

export function validateLedgerRecord(value: unknown): value is IntelligenceAuditRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<IntelligenceAuditRecord>;
  return record.schemaVersion === 1
    && typeof record.runId === "string" && record.runId.length > 0
    && typeof record.createdAt === "string" && Number.isFinite(Date.parse(record.createdAt))
    && record.mode === "research-only"
    && Array.isArray(record.stages) && Array.isArray(record.events)
    && record.policy?.eligibleForExecution === false
    && record.policy?.approvedNotional === 0
    && Array.isArray(record.integrity?.missingStages)
    && Number.isFinite(record.integrity?.eventCount);
}

export function readRunLedger(storage: Pick<Storage, "getItem">): RunLedgerSnapshot {
  const fallback: RunLedgerSnapshot = { schemaVersion: 1, updatedAt: new Date(0).toISOString(), records: [] };
  try {
    const raw = storage.getItem(RUN_LEDGER_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return fallback;
    const candidate = parsed as Partial<RunLedgerSnapshot>;
    if (candidate.schemaVersion !== 1 || !Array.isArray(candidate.records)) return fallback;
    const records = candidate.records.filter(validateLedgerRecord);
    return {
      schemaVersion: 1,
      updatedAt: typeof candidate.updatedAt === "string" && Number.isFinite(Date.parse(candidate.updatedAt))
        ? candidate.updatedAt : new Date(0).toISOString(),
      records: records.slice(0, RUN_LEDGER_MAX_RECORDS),
    };
  } catch {
    // Storage may be disabled, full, or contain malformed data.
    return fallback;
  }
}

export function appendRunLedgerRecord(
  storage: Pick<Storage, "getItem" | "setItem">,
  record: IntelligenceAuditRecord,
  now = new Date(),
): RunLedgerSnapshot {
  if (!validateLedgerRecord(record)) throw new Error("Refusing to persist an invalid or execution-enabled ledger record.");
  const current = readRunLedger(storage);
  const records = [record, ...current.records.filter(existing => existing.runId !== record.runId)]
    .slice(0, RUN_LEDGER_MAX_RECORDS);
  const snapshot: RunLedgerSnapshot = {
    schemaVersion: 1,
    updatedAt: Number.isFinite(now.getTime()) ? now.toISOString() : new Date().toISOString(),
    records,
  };
  storage.setItem(RUN_LEDGER_STORAGE_KEY, JSON.stringify(snapshot));
  return snapshot;
}

export function clearRunLedger(storage: Pick<Storage, "removeItem">): void {
  storage.removeItem(RUN_LEDGER_STORAGE_KEY);
}

export function exportRunLedger(snapshot: RunLedgerSnapshot): string {
  return JSON.stringify({
    ...snapshot,
    export: {
      format: "techunified-ai-os-run-ledger",
      exportedAt: new Date().toISOString(),
      durability: "browser-local",
      integrityNote: "Export is not digitally signed and is not tamper-proof.",
    },
  }, null, 2);
}
