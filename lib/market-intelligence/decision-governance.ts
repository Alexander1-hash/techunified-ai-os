import type { StrategySignal } from "./strategy-engine";
import type { OpportunityCandidate } from "./opportunity-detection";
import type { RiskAssessment } from "./risk-engine";
import type { ValidationReport } from "./strategy-validation";

export type GovernanceReason =
  | "invalid-or-incomplete-evidence"
  | "signal-candidate-mismatch"
  | "non-live-market-data"
  | "opportunity-blocked"
  | "validation-not-sufficient"
  | "risk-check-blocked"
  | "capital-not-authorized"
  | "human-review-required";

export type GovernanceDecision = {
  schemaVersion: 1;
  evaluatedAt: string;
  symbol: string;
  outcome: "blocked" | "research-only" | "requires-human-review";
  reasons: GovernanceReason[];
  evidence: {
    signalDirection: StrategySignal["direction"] | null;
    dataSource: string | null;
    dataStatus: string | null;
    opportunityState: OpportunityCandidate["state"] | null;
    validationStatus: ValidationReport["status"] | null;
    riskStatus: RiskAssessment["status"] | null;
  };
  mode: "research-only";
  eligibleForExecution: false;
  approvedNotional: 0;
  summary: string;
};

export type GovernanceInput = {
  signal: StrategySignal;
  opportunity: OpportunityCandidate;
  risk: RiskAssessment;
  validation: ValidationReport;
};

/**
 * Fail-closed aggregation boundary. This module reports policy/evidence state;
 * it cannot authorize capital, issue orders, or convert demo data into live data.
 */
export function evaluateDecisionGovernance(input: GovernanceInput, evaluatedAt = new Date()): GovernanceDecision {
  const { signal, opportunity, risk, validation } = input;
  const reasons: GovernanceReason[] = [];
  const validDate = Number.isFinite(evaluatedAt.getTime());
  const validSignal = Boolean(signal && typeof signal.symbol === "string" && signal.symbol.length > 0
    && Number.isFinite(signal.observedPrice) && signal.observedPrice > 0
    && Number.isFinite(Date.parse(signal.observedAt)));
  const validOpportunity = Boolean(opportunity && opportunity.schemaVersion === 1
    && opportunity.symbol === signal?.symbol && opportunity.mode === "research-only"
    && opportunity.eligibleForExecution === false && Array.isArray(opportunity.blockers));
  const validRisk = Boolean(risk && risk.schemaVersion === 1 && risk.approvedNotional === 0
    && Array.isArray(risk.checks) && Number.isFinite(risk.requestedNotional));
  const validValidation = Boolean(validation && validation.schemaVersion === 1
    && validation.mode === "research-only" && Array.isArray(validation.folds)
    && Number.isFinite(validation.stabilityPercent));
  if (!validDate || !validSignal || !validOpportunity || !validRisk || !validValidation) {
    reasons.push("invalid-or-incomplete-evidence");
  }
  if (validSignal && validOpportunity && (signal.symbol !== opportunity.symbol || signal.direction !== opportunity.direction)) {
    reasons.push("signal-candidate-mismatch");
  }
  if (signal?.source !== "provider" || signal?.dataStatus !== "live") reasons.push("non-live-market-data");
  if (opportunity?.state !== "research-candidate" || (opportunity?.blockers?.length ?? 1) > 0) reasons.push("opportunity-blocked");
  if (validation?.status !== "completed" || validation?.folds?.length < 5 || validation?.stabilityPercent < 60) {
    reasons.push("validation-not-sufficient");
  }
  if (risk?.status !== "review-required" || risk?.checks?.some(check => !check.passed)) reasons.push("risk-check-blocked");
  // Current product policy intentionally has no pathway that grants capital.
  reasons.push("capital-not-authorized");

  const hardBlockers = reasons.some(reason => reason !== "capital-not-authorized" && reason !== "human-review-required");
  if (!hardBlockers) reasons.push("human-review-required");
  const outcome: GovernanceDecision["outcome"] = hardBlockers
    ? "blocked"
    : reasons.includes("human-review-required") ? "requires-human-review" : "research-only";

  return {
    schemaVersion: 1,
    evaluatedAt: validDate ? evaluatedAt.toISOString() : new Date(0).toISOString(),
    symbol: typeof signal?.symbol === "string" ? signal.symbol : "UNKNOWN",
    outcome,
    reasons: Array.from(new Set(reasons)),
    evidence: {
      signalDirection: signal?.direction ?? null,
      dataSource: signal?.source ?? null,
      dataStatus: signal?.dataStatus ?? null,
      opportunityState: opportunity?.state ?? null,
      validationStatus: validation?.status ?? null,
      riskStatus: risk?.status ?? null,
    },
    mode: "research-only",
    eligibleForExecution: false,
    approvedNotional: 0,
    summary: hardBlockers
      ? "Blocked: one or more evidence or policy gates failed. No capital is authorized."
      : "Evidence gates require human review. No capital is authorized and execution remains disabled.",
  };
}

export const GOVERNANCE_REASON_LABELS: Record<GovernanceReason, string> = {
  "invalid-or-incomplete-evidence": "Evidence is missing, malformed, or incomplete",
  "signal-candidate-mismatch": "Signal and opportunity candidate do not match",
  "non-live-market-data": "Market data is not verified live provider data",
  "opportunity-blocked": "Opportunity detection remains blocked",
  "validation-not-sufficient": "Validation evidence is incomplete or below policy thresholds",
  "risk-check-blocked": "Risk assessment is blocked or contains failed checks",
  "capital-not-authorized": "Capital authorization is disabled by system policy",
  "human-review-required": "Human review is required before any future policy change",
};
