/**
 * Human-governed recruitment workflow primitives.
 *
 * These pure domain functions do not persist records or grant authorization.
 * Callers must authenticate the actor, enforce organization-level access in
 * the data layer, and record the returned audit event transactionally.
 */

export type RecruitmentStage =
  | "sourced"
  | "invited"
  | "applied"
  | "screening"
  | "assessment"
  | "interview"
  | "reference_check"
  | "offer_pending_approval"
  | "offer_sent"
  | "hired"
  | "rejected"
  | "withdrawn";

export type RecruitmentActorRole =
  | "recruiter"
  | "hiring_manager"
  | "organization_admin"
  | "system";

export interface RecruitmentRecord {
  id: string;
  organizationId: string;
  vacancyId: string;
  candidateId: string;
  stage: RecruitmentStage;
  processingAuthorized: boolean;
  /** True only after a human reviewer has confirmed mandatory credentials. */
  mandatoryCredentialsVerified: boolean;
  /** True only after an authorized human has recorded the hiring decision. */
  humanHiringApproval: boolean;
  updatedAt: string;
}

export interface RecruitmentActor {
  id: string;
  organizationId: string;
  role: RecruitmentActorRole;
}

export type RecruitmentTransitionAction =
  | "invite"
  | "record_application"
  | "start_screening"
  | "request_assessment"
  | "schedule_interview"
  | "start_reference_check"
  | "submit_offer_for_approval"
  | "approve_offer"
  | "send_offer"
  | "mark_hired"
  | "reject"
  | "withdraw";

export interface RecruitmentAuditEvent {
  recruitmentId: string;
  organizationId: string;
  vacancyId: string;
  candidateId: string;
  actorId: string;
  action: RecruitmentTransitionAction;
  fromStage: RecruitmentStage;
  toStage: RecruitmentStage;
  occurredAt: string;
  reason?: string;
}

export type RecruitmentTransitionResult =
  | { ok: true; record: RecruitmentRecord; auditEvent: RecruitmentAuditEvent }
  | { ok: false; code: "invalid_record" | "unauthorized" | "not_allowed" | "missing_evidence"; message: string };

const TRANSITIONS: Record<RecruitmentTransitionAction, RecruitmentStage[]> = {
  invite: ["invited"],
  record_application: ["applied"],
  start_screening: ["screening"],
  request_assessment: ["assessment"],
  schedule_interview: ["interview"],
  start_reference_check: ["reference_check"],
  submit_offer_for_approval: ["offer_pending_approval"],
  approve_offer: ["offer_pending_approval"],
  send_offer: ["offer_sent"],
  mark_hired: ["hired"],
  reject: ["rejected"],
  withdraw: ["withdrawn"],
};

const ALLOWED_FROM: Record<RecruitmentTransitionAction, RecruitmentStage[]> = {
  invite: ["sourced"],
  record_application: ["invited", "sourced"],
  start_screening: ["applied", "invited"],
  request_assessment: ["screening"],
  schedule_interview: ["screening", "assessment"],
  start_reference_check: ["interview"],
  submit_offer_for_approval: ["reference_check", "interview"],
  approve_offer: ["offer_pending_approval"],
  send_offer: ["offer_pending_approval"],
  mark_hired: ["offer_sent"],
  reject: ["invited", "applied", "screening", "assessment", "interview", "reference_check", "offer_pending_approval", "offer_sent"],
  withdraw: ["invited", "applied", "screening", "assessment", "interview", "reference_check", "offer_pending_approval", "offer_sent"],
};

/**
 * Validate a single workflow transition. This function intentionally does not
 * decide candidate suitability; it enforces workflow gates and audit metadata.
 */
export function transitionRecruitment(
  record: RecruitmentRecord,
  actor: RecruitmentActor,
  action: RecruitmentTransitionAction,
  options: { occurredAt: string; reason?: string }
): RecruitmentTransitionResult {
  if (
    !record.id.trim() ||
    !record.organizationId.trim() ||
    !record.vacancyId.trim() ||
    !record.candidateId.trim() ||
    !isValidDate(record.updatedAt)
  ) {
    return { ok: false, code: "invalid_record", message: "The recruitment record is incomplete or invalid." };
  }

  if (!actor.id.trim() || actor.organizationId !== record.organizationId) {
    return { ok: false, code: "unauthorized", message: "The actor is not authorized for this organization's recruitment record." };
  }

  if (actor.role === "system" || !isValidDate(options.occurredAt)) {
    return { ok: false, code: "unauthorized", message: "A valid human actor and event timestamp are required for this transition." };
  }

  if (!record.processingAuthorized) {
    return { ok: false, code: "unauthorized", message: "Candidate processing authorization is required before workflow changes." };
  }

  if (!ALLOWED_FROM[action].includes(record.stage)) {
    return { ok: false, code: "not_allowed", message: `Action '${action}' is not allowed from stage '${record.stage}'.` };
  }

  if (action === "approve_offer" || action === "send_offer" || action === "mark_hired") {
    if (actor.role !== "hiring_manager" && actor.role !== "organization_admin") {
      return { ok: false, code: "unauthorized", message: "Only a hiring manager or organization administrator can approve or finalize an offer." };
    }
  }

  if (action === "mark_hired" && !record.mandatoryCredentialsVerified) {
    return { ok: false, code: "missing_evidence", message: "Mandatory credentials must be verified by an authorized human before marking a candidate hired." };
  }

  if (action === "mark_hired" && !record.humanHiringApproval) {
    return { ok: false, code: "missing_evidence", message: "A human hiring approval must be recorded before marking a candidate hired." };
  }

  if (action === "reject" && !options.reason?.trim()) {
    return { ok: false, code: "missing_evidence", message: "Record a job-related reason and supporting review before rejecting a candidate." };
  }

  if (action === "withdraw" && !options.reason?.trim()) {
    return { ok: false, code: "missing_evidence", message: "Record the withdrawal context before closing the recruitment record." };
  }

  const nextStage = action === "approve_offer"
    ? "offer_pending_approval"
    : TRANSITIONS[action][0];

  const updatedRecord: RecruitmentRecord = {
    ...record,
    stage: nextStage,
    ...(action === "approve_offer" ? { humanHiringApproval: true } : {}),
    updatedAt: new Date(options.occurredAt).toISOString(),
  };

  const auditEvent: RecruitmentAuditEvent = {
    recruitmentId: record.id,
    organizationId: record.organizationId,
    vacancyId: record.vacancyId,
    candidateId: record.candidateId,
    actorId: actor.id,
    action,
    fromStage: record.stage,
    toStage: nextStage,
    occurredAt: updatedRecord.updatedAt,
    ...(options.reason?.trim() ? { reason: options.reason.trim().slice(0, 500) } : {}),
  };

  return { ok: true, record: updatedRecord, auditEvent };
}

function isValidDate(value: string): boolean {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
