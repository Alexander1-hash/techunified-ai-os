/**
 * Universal workforce and recruitment intelligence contracts.
 *
 * This module is deliberately industry-agnostic: each role supplies its own
 * job-related requirements, jurisdiction, and evidence expectations. It does
 * not scrape candidate sources, make hiring decisions, or replace credential
 * verification and human review.
 */

export type OccupationalRequirementKind =
  | "skill"
  | "qualification"
  | "professional_license"
  | "experience"
  | "work_authorization"
  | "language"
  | "safety"
  | "other";

export type RequirementImportance = "required" | "preferred";

export type EvidenceExpectation =
  | "candidate_statement"
  | "document_review"
  | "practical_assessment"
  | "authoritative_source";

export interface OccupationalRequirement {
  /** Stable, role-specific identifier used to map candidate evidence. */
  id: string;
  label: string;
  kind: OccupationalRequirementKind;
  importance: RequirementImportance;
  /** Integer weight from 1 (low) to 5 (high); defaults to 1. */
  weight?: number;
  evidenceExpectation: EvidenceExpectation;
  /** Use for jurisdiction-dependent licences or legal requirements. */
  jurisdiction?: string;
}

export interface OccupationalProfile {
  title: string;
  industry: string;
  /** Country, state/province, or other relevant licensing jurisdiction. */
  jurisdiction?: string;
  responsibilities: string[];
  requirements: OccupationalRequirement[];
  /** Job-related assessment methods approved by the hiring organization. */
  assessmentMethods: string[];
}

export type CandidateEvidenceStatus =
  | "verified"
  | "self_reported"
  | "not_met"
  | "unknown";

export interface CandidateRequirementEvidence {
  requirementId: string;
  status: CandidateEvidenceStatus;
  /** Evidence reference or a short provenance note; avoid storing excess PII. */
  evidenceReference?: string;
  reviewedAt?: string;
}

export interface CandidateAssessmentInput {
  candidateId: string;
  /** Do not score or retain candidate data through this workflow without authorization. */
  processingAuthorized: boolean;
  evidence: CandidateRequirementEvidence[];
}

export type CandidateMatchDisposition =
  | "strong_match"
  | "review_required"
  | "insufficient_evidence"
  | "required_criteria_not_met"
  | "not_assessed";

export interface CandidateMatchResult {
  candidateId: string;
  disposition: CandidateMatchDisposition;
  /** Evidence-weighted indicator, not a probability of job performance. */
  matchScore: number | null;
  requiredCriteriaMet: number;
  requiredCriteriaTotal: number;
  requirementsNeedingReview: string[];
  unmetRequiredCriteria: string[];
  explanation: string;
}

/**
 * Produce a transparent, deterministic first-pass comparison against a
 * role-specific profile. Protected characteristics and unrelated personal
 * attributes are intentionally absent from the input contract.
 */
export function assessCandidateMatch(
  role: OccupationalProfile,
  candidate: CandidateAssessmentInput
): CandidateMatchResult {
  if (!candidate.processingAuthorized) {
    return {
      candidateId: candidate.candidateId,
      disposition: "not_assessed",
      matchScore: null,
      requiredCriteriaMet: 0,
      requiredCriteriaTotal: countRequired(role),
      requirementsNeedingReview: [],
      unmetRequiredCriteria: [],
      explanation:
        "Candidate assessment was not run because processing is not authorized.",
    };
  }

  const invalidProfileReason = validateOccupationalProfile(role);
  if (invalidProfileReason) {
    return {
      candidateId: candidate.candidateId,
      disposition: "not_assessed",
      matchScore: null,
      requiredCriteriaMet: 0,
      requiredCriteriaTotal: countRequired(role),
      requirementsNeedingReview: [],
      unmetRequiredCriteria: [],
      explanation: invalidProfileReason,
    };
  }

  const evidenceByRequirement = new Map(
    candidate.evidence.map((item) => [item.requirementId, item])
  );
  const requirementsNeedingReview: string[] = [];
  const unmetRequiredCriteria: string[] = [];
  let requiredCriteriaMet = 0;
  let weightedScore = 0;
  let totalWeight = 0;
  let hasAnyEvidence = false;

  for (const requirement of role.requirements) {
    const weight = clampWeight(requirement.weight);
    const evidence = evidenceByRequirement.get(requirement.id);
    totalWeight += weight;

    if (evidence && evidence.status !== "unknown") {
      hasAnyEvidence = true;
    }

    switch (evidence?.status ?? "unknown") {
      case "verified":
        weightedScore += weight;
        if (requirement.importance === "required") requiredCriteriaMet += 1;
        break;
      case "self_reported":
        // A claim can inform review but is not treated as verified evidence.
        weightedScore += weight * 0.5;
        requirementsNeedingReview.push(requirement.label);
        break;
      case "not_met":
        if (requirement.importance === "required") {
          unmetRequiredCriteria.push(requirement.label);
        }
        break;
      case "unknown":
        requirementsNeedingReview.push(requirement.label);
        break;
    }
  }

  const matchScore =
    totalWeight === 0 ? 0 : Math.round((weightedScore / totalWeight) * 100);
  const requiredCriteriaTotal = countRequired(role);

  if (unmetRequiredCriteria.length > 0) {
    return {
      candidateId: candidate.candidateId,
      disposition: "required_criteria_not_met",
      matchScore,
      requiredCriteriaMet,
      requiredCriteriaTotal,
      requirementsNeedingReview: unique(requirementsNeedingReview),
      unmetRequiredCriteria,
      explanation:
        "Evidence indicates that one or more explicitly required criteria are not met. A human reviewer should confirm the evidence before taking action.",
    };
  }

  if (!hasAnyEvidence) {
    return {
      candidateId: candidate.candidateId,
      disposition: "insufficient_evidence",
      matchScore,
      requiredCriteriaMet,
      requiredCriteriaTotal,
      requirementsNeedingReview: unique(requirementsNeedingReview),
      unmetRequiredCriteria: [],
      explanation:
        "There is not enough candidate evidence to support a meaningful comparison.",
    };
  }

  const hasUnverifiedRequired = role.requirements.some(
    (requirement) =>
      requirement.importance === "required" &&
      evidenceByRequirement.get(requirement.id)?.status !== "verified"
  );

  const disposition: CandidateMatchDisposition =
    hasUnverifiedRequired || requirementsNeedingReview.length > 0
      ? "review_required"
      : matchScore >= 80
        ? "strong_match"
        : "review_required";

  return {
    candidateId: candidate.candidateId,
    disposition,
    matchScore,
    requiredCriteriaMet,
    requiredCriteriaTotal,
    requirementsNeedingReview: unique(requirementsNeedingReview),
    unmetRequiredCriteria: [],
    explanation:
      "This score summarizes the available job-related evidence only. It is not a hiring decision or a prediction of future performance; review qualifications, context, and any required professional registration before proceeding.",
  };
}

export function validateOccupationalProfile(
  role: OccupationalProfile
): string | null {
  if (!role.title.trim()) return "An occupational profile must include a role title.";
  if (!role.industry.trim()) return "An occupational profile must include an industry.";
  if (role.requirements.length === 0) {
    return "An occupational profile must define at least one job-related requirement.";
  }

  const ids = new Set<string>();
  for (const requirement of role.requirements) {
    if (!requirement.id.trim() || !requirement.label.trim()) {
      return "Every occupational requirement must have an identifier and label.";
    }
    if (ids.has(requirement.id)) {
      return `Duplicate occupational requirement identifier: ${requirement.id}`;
    }
    ids.add(requirement.id);
    if (
      requirement.weight !== undefined &&
      (!Number.isInteger(requirement.weight) ||
        requirement.weight < 1 ||
        requirement.weight > 5)
    ) {
      return `Requirement weight must be an integer from 1 to 5: ${requirement.id}`;
    }
  }

  return null;
}

function countRequired(role: OccupationalProfile): number {
  return role.requirements.filter(
    (requirement) => requirement.importance === "required"
  ).length;
}

function clampWeight(weight: number | undefined): number {
  return weight === undefined ? 1 : Math.min(5, Math.max(1, weight));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
