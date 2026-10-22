import type { GovernanceDecision } from "./decision-governance";

export type IntelligenceStage =
  | "market-data"
  | "strategy"
  | "opportunity"
  | "validation"
  | "risk"
  | "governance";

export type StageEvidence = {
  stage: IntelligenceStage;
  status: "passed" | "blocked" | "incomplete" | "research-only";
  reference: string;
  detail: string;
};

export type AuditEvent = {
  sequence: number;
  eventType: "stage-evaluated" | "policy-blocked" | "decision-recorded";
  stage: IntelligenceStage | "audit";
  code: string;
  detail: string;
};

export type IntelligenceAuditRecord = {
  schemaVersion: 1;
  runId: string;
  createdAt: string;
  mode: "research-only";
  finalOutcome: GovernanceDecision["outcome"];
  stages: StageEvidence[];
  events: AuditEvent[];
  policy: {
    eligibleForExecution: false;
    approvedNotional: 0;
    authorizationRequired: true;
  };
  integrity: {
    complete: boolean;
    missingStages: IntelligenceStage[];
    eventCount: number;
  };
  disclaimer: string;
};

const REQUIRED_STAGES: IntelligenceStage[] = [
  "market-data", "strategy", "opportunity", "validation", "risk", "governance",
];

/**
 * Creates a reviewable, ordered audit snapshot from the evidence stages and
 * governance decision. This is an in-memory report, not durable storage or a
 * cryptographic proof; persist it to an append-only store before relying on it
 * for regulated or financial audit requirements.
 */
export function createIntelligenceAudit(
  decision: GovernanceDecision,
  stages: StageEvidence[],
  createdAt = new Date(),
): IntelligenceAuditRecord {
  const timestampValid = Number.isFinite(createdAt.getTime());
  const safeTime = timestampValid ? createdAt.toISOString() : new Date(0).toISOString();
  const seen = new Set<IntelligenceStage>();
  const normalizedStages: StageEvidence[] = [];

  for (const stage of stages) {
    if (!stage || !REQUIRED_STAGES.includes(stage.stage) || seen.has(stage.stage)) continue;
    seen.add(stage.stage);
    normalizedStages.push({
      stage: stage.stage,
      status: ["passed", "blocked", "incomplete", "research-only"].includes(stage.status) ? stage.status : "incomplete",
      reference: typeof stage.reference === "string" ? stage.reference.slice(0, 120) : "missing-reference",
      detail: typeof stage.detail === "string" ? stage.detail.slice(0, 500) : "No stage detail supplied.",
    });
  }

  const missingStages = REQUIRED_STAGES.filter(stage => !seen.has(stage));
  const events: AuditEvent[] = [];
  for (const stage of normalizedStages) {
    events.push({
      sequence: events.length + 1,
      eventType: "stage-evaluated",
      stage: stage.stage,
      code: `stage.${stage.stage}.${stage.status}`,
      detail: `${stage.reference}: ${stage.detail}`,
    });
    if (stage.status === "blocked" || stage.status === "incomplete") {
      events.push({
        sequence: events.length + 1,
        eventType: "policy-blocked",
        stage: stage.stage,
        code: stage.status === "blocked" ? "stage.blocked" : "stage.incomplete",
        detail: `Stage ${stage.stage} cannot be treated as cleared.`,
      });
    }
  }
  for (const reason of decision.reasons) {
    events.push({
      sequence: events.length + 1,
      eventType: "policy-blocked",
      stage: "governance",
      code: `governance.${reason}`,
      detail: reason,
    });
  }
  events.push({
    sequence: events.length + 1,
    eventType: "decision-recorded",
    stage: "audit",
    code: `decision.${decision.outcome}`,
    detail: `Governance outcome recorded for ${decision.symbol}; execution eligibility remains false.`,
  });

  const complete = timestampValid && missingStages.length === 0 && decision.schemaVersion === 1
    && decision.eligibleForExecution === false && decision.approvedNotional === 0;
  // Readable run key for correlation only; deliberately not presented as a secure hash.
  const runId = `mi-${safeTime.replace(/[-:.TZ]/g, "").slice(0, 14)}-${String(decision.symbol || "unknown").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 12) || "unknown"}`;

  return {
    schemaVersion: 1,
    runId,
    createdAt: safeTime,
    mode: "research-only",
    finalOutcome: decision.outcome,
    stages: normalizedStages,
    events,
    policy: {
      eligibleForExecution: false,
      approvedNotional: 0,
      authorizationRequired: true,
    },
    integrity: { complete, missingStages, eventCount: events.length },
    disclaimer: "Audit snapshot is in-memory and not tamper-proof or durably persisted. Do not rely on it as a regulated audit trail until backed by authenticated, append-only storage, retention controls, access controls, and independent verification. No orders are sent.",
  };
}

export const INTELLIGENCE_STAGE_LABELS: Record<IntelligenceStage, string> = {
  "market-data": "Market data",
  strategy: "Strategy signal",
  opportunity: "Opportunity detection",
  validation: "Walk-forward validation",
  risk: "Risk assessment",
  governance: "Decision governance",
};
