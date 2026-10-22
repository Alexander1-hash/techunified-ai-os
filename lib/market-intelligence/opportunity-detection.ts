import type { StrategySignal } from "./strategy-engine";
import type { ValidationReport } from "./strategy-validation";

export type OpportunityBlocker = "demo-or-non-live-data" | "neutral-signal" | "validation-insufficient" | "validation-not-positive" | "validation-evidence-too-small" | "stale-observation" | "invalid-input";
export type OpportunityCandidate = { schemaVersion: 1; evaluatedAt: string; symbol: string; direction: StrategySignal["direction"]; state: "blocked" | "research-candidate"; score: number; reasons: string[]; blockers: OpportunityBlocker[]; source: StrategySignal["source"]; dataStatus: StrategySignal["dataStatus"]; observedAt: string; mode: "research-only"; eligibleForExecution: false };
export type OpportunityPolicy = { minimumPositiveFoldRatioPercent: number; minimumValidationFolds: number; maximumQuoteAgeMs: number };
const DEFAULT_POLICY: OpportunityPolicy = { minimumPositiveFoldRatioPercent: 60, minimumValidationFolds: 5, maximumQuoteAgeMs: 5 * 60_000 };

/** Evidence-gated triage only; never estimates profit probability or authorizes orders. */
export function detectOpportunity(signal: StrategySignal, validation: ValidationReport, evaluatedAt = new Date(), policy: OpportunityPolicy = DEFAULT_POLICY): OpportunityCandidate {
  const blockers: OpportunityBlocker[] = [];
  const reasons: string[] = [];
  const now = evaluatedAt.getTime();
  const observed = Date.parse(signal.observedAt);
  const validPrice = Number.isFinite(signal.observedPrice) && signal.observedPrice > 0;
  const validTime = Number.isFinite(observed) && observed <= now + 60_000;
  if (!validPrice || !validTime || !Number.isFinite(now)) blockers.push("invalid-input");
  if (signal.source !== "provider" || signal.dataStatus !== "live") blockers.push("demo-or-non-live-data");
  if (signal.direction === "neutral") blockers.push("neutral-signal");
  if (validTime && now - observed > policy.maximumQuoteAgeMs) blockers.push("stale-observation");
  if (validation.status !== "completed") blockers.push("validation-insufficient");
  if (validation.status === "completed" && validation.averageValidationReturnPercent <= 0) blockers.push("validation-not-positive");
  if (validation.folds.length < policy.minimumValidationFolds) blockers.push("validation-evidence-too-small");
  if (validation.stabilityPercent < policy.minimumPositiveFoldRatioPercent && !blockers.includes("validation-not-positive")) blockers.push("validation-not-positive");
  reasons.push("Directional observation: " + signal.direction + " for " + signal.symbol + ".");
  reasons.push("Input provenance: " + signal.source + " / " + signal.dataStatus + ".");
  reasons.push("Walk-forward evidence: " + validation.folds.length + " fold(s), average holdout " + validation.averageValidationReturnPercent.toFixed(2) + "%, positive-fold ratio " + validation.stabilityPercent.toFixed(1) + "%.");
  reasons.push(blockers.length ? "One or more evidence gates failed; keep this item blocked and research-only." : "Research evidence gates passed; this is still not a trade recommendation or execution approval.");
  const score = Math.max(0, Math.min(100, Math.round(signal.confidence * 30 + Math.min(validation.folds.length / policy.minimumValidationFolds, 1) * 25 + Math.min(Math.max(validation.stabilityPercent, 0) / 100, 1) * 25 + (validation.averageValidationReturnPercent > 0 ? 20 : 0))));
  return { schemaVersion: 1, evaluatedAt: evaluatedAt.toISOString(), symbol: signal.symbol, direction: signal.direction, state: blockers.length ? "blocked" : "research-candidate", score, reasons, blockers, source: signal.source, dataStatus: signal.dataStatus, observedAt: signal.observedAt, mode: "research-only", eligibleForExecution: false };
}

export const OPPORTUNITY_BLOCKER_LABELS: Record<OpportunityBlocker, string> = {
  "demo-or-non-live-data": "Input is demo, delayed, or not verified live data",
  "neutral-signal": "No directional signal",
  "validation-insufficient": "Walk-forward validation is incomplete",
  "validation-not-positive": "Holdout evidence does not meet positive/stability threshold",
  "validation-evidence-too-small": "Too few validation folds",
  "stale-observation": "Quote is older than the allowed freshness window",
  "invalid-input": "Invalid price or timestamp",
};