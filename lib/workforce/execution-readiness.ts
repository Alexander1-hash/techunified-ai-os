/**
 * Fail-closed readiness contract for workforce automation.
 *
 * This module records readiness decisions only. It does not execute workflows,
 * call providers, grant permissions, or replace a human approval.
 */

export type WorkflowExecutionState =
  | "draft"
  | "validation_required"
  | "awaiting_approval"
  | "ready_for_pilot"
  | "running"
  | "completed"
  | "failed"
  | "stopped";

export type WorkflowReadinessGate =
  | "process_owner_assigned"
  | "integration_verified"
  | "least_privilege_verified"
  | "baseline_recorded"
  | "pilot_scope_approved"
  | "validation_passed"
  | "human_approval_recorded";

export interface WorkflowReadinessEvidence {
  processOwnerId?: string | null;
  integrationVerified: boolean;
  leastPrivilegeVerified: boolean;
  baselineRecorded: boolean;
  pilotScopeApproved: boolean;
  validationPassed: boolean;
  humanApprovalRecorded: boolean;
  /** Approval and evidence must be rechecked when this changes. */
  configurationFingerprint: string;
  evidenceRecordedAt: string;
}

export interface WorkflowReadinessReport {
  ready: boolean;
  state: WorkflowExecutionState;
  missingGates: WorkflowReadinessGate[];
  blockers: string[];
  executionPermitted: false;
  checkedAt: string;
  configurationFingerprint: string | null;
}

export interface WorkflowTransitionRequest {
  from: WorkflowExecutionState;
  to: WorkflowExecutionState;
  evidence: WorkflowReadinessEvidence;
  now: string;
  expectedConfigurationFingerprint?: string;
}

const TERMINAL_STATES: WorkflowExecutionState[] = ["completed", "failed", "stopped"];

const TRANSITIONS: Record<WorkflowExecutionState, WorkflowExecutionState[]> = {
  draft: ["validation_required", "stopped"],
  validation_required: ["awaiting_approval", "failed", "stopped"],
  awaiting_approval: ["ready_for_pilot", "validation_required", "failed", "stopped"],
  ready_for_pilot: ["running", "validation_required", "stopped"],
  running: ["completed", "failed", "stopped"],
  completed: [],
  failed: ["validation_required", "stopped"],
  stopped: ["validation_required"],
};

function validTimestamp(value: string): boolean {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function evaluateWorkflowReadiness(
  evidence: WorkflowReadinessEvidence,
  checkedAt = new Date().toISOString(),
): WorkflowReadinessReport {
  const missingGates: WorkflowReadinessGate[] = [];
  const blockers: string[] = [];

  if (!evidence.processOwnerId?.trim()) missingGates.push("process_owner_assigned");
  if (evidence.integrationVerified !== true) missingGates.push("integration_verified");
  if (evidence.leastPrivilegeVerified !== true) missingGates.push("least_privilege_verified");
  if (evidence.baselineRecorded !== true) missingGates.push("baseline_recorded");
  if (evidence.pilotScopeApproved !== true) missingGates.push("pilot_scope_approved");
  if (evidence.validationPassed !== true) missingGates.push("validation_passed");
  if (evidence.humanApprovalRecorded !== true) missingGates.push("human_approval_recorded");

  if (!validTimestamp(evidence.evidenceRecordedAt)) blockers.push("Evidence timestamp is missing or invalid.");
  else {
    const evidenceAgeMs = Date.parse(checkedAt) - Date.parse(evidence.evidenceRecordedAt);
    if (evidenceAgeMs < 0) blockers.push("Evidence timestamp is in the future.");
    if (evidenceAgeMs > 24 * 60 * 60 * 1000) blockers.push("Readiness evidence is older than 24 hours and must be revalidated.");
  }
  if (!validTimestamp(checkedAt)) blockers.push("Readiness check timestamp is invalid.");
  if (!evidence.configurationFingerprint?.trim()) blockers.push("Configuration fingerprint is required.");
  if (evidence.integrationVerified !== true) blockers.push("No verified integration is available for execution.");
  if (evidence.leastPrivilegeVerified !== true) blockers.push("Least-privilege access has not been verified.");
  if (evidence.validationPassed !== true) blockers.push("Validation has not passed.");
  if (evidence.humanApprovalRecorded !== true) blockers.push("Explicit human approval has not been recorded.");

  const ready = missingGates.length === 0 && blockers.length === 0;
  return {
    ready,
    state: ready ? "ready_for_pilot" : "validation_required",
    missingGates,
    blockers,
    // This contract never starts or performs work. A separate approved runner
    // must enforce these gates again immediately before any consequential action.
    executionPermitted: false,
    checkedAt,
    configurationFingerprint: evidence.configurationFingerprint?.trim() || null,
  };
}

export type WorkflowTransitionResult =
  | { ok: true; from: WorkflowExecutionState; to: WorkflowExecutionState; requiresFreshReadinessCheck: boolean }
  | { ok: false; code: "invalid_timestamp" | "invalid_transition" | "terminal_state" | "readiness_required" | "stale_evidence"; message: string };

/**
 * Validate a requested state transition without performing the transition.
 * Running is blocked unless all readiness gates pass and the evidence still
 * matches the current configuration. Callers must persist transitions and audit
 * them transactionally in an authorized server-side data layer.
 */
export function validateWorkflowTransition(
  request: WorkflowTransitionRequest,
): WorkflowTransitionResult {
  if (!validTimestamp(request.now) || !validTimestamp(request.evidence.evidenceRecordedAt)) {
    return { ok: false, code: "invalid_timestamp", message: "Valid timestamps are required for transition and readiness evidence." };
  }
  if (TERMINAL_STATES.includes(request.from)) {
    return { ok: false, code: "terminal_state", message: "Terminal workflows cannot transition directly; create a new run or explicitly reopen through an authorized recovery flow." };
  }
  if (!TRANSITIONS[request.from].includes(request.to)) {
    return { ok: false, code: "invalid_transition", message: `Transition from '${request.from}' to '${request.to}' is not allowed.` };
  }
  if (
    request.expectedConfigurationFingerprint &&
    request.expectedConfigurationFingerprint !== request.evidence.configurationFingerprint
  ) {
    return { ok: false, code: "stale_evidence", message: "Workflow configuration changed after evidence was recorded; validate and approve again." };
  }
  if (request.to === "running") {
    const report = evaluateWorkflowReadiness(request.evidence, request.now);
    if (!report.ready) {
      return { ok: false, code: "readiness_required", message: `Execution is blocked. Missing gates: ${report.missingGates.join(", ") || "valid readiness evidence"}.` };
    }
    return { ok: true, from: request.from, to: request.to, requiresFreshReadinessCheck: true };
  }
  if (request.to === "ready_for_pilot" && !evaluateWorkflowReadiness(request.evidence, request.now).ready) {
    return { ok: false, code: "readiness_required", message: "Pilot readiness requires all evidence and approval gates to pass." };
  }
  return { ok: true, from: request.from, to: request.to, requiresFreshReadinessCheck: request.to === "ready_for_pilot" };
}
