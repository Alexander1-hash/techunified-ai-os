import {
  type EvidenceExpectation,
  type OccupationalProfile,
  type OccupationalRequirement,
  type OccupationalRequirementKind,
  type RequirementImportance,
  validateOccupationalProfile,
} from "./intelligence";

export interface OccupationalRequirementDraft {
  label: string;
  kind: OccupationalRequirementKind;
  importance: RequirementImportance;
  evidenceExpectation: EvidenceExpectation;
  weight?: number;
  jurisdiction?: string;
}

export interface OccupationalProfileDraft {
  title: string;
  industry: string;
  jurisdiction?: string;
  responsibilities: string[];
  requirements: OccupationalRequirementDraft[];
  assessmentMethods: string[];
}

export type ProfileBuildResult =
  | { ok: true; profile: OccupationalProfile }
  | { ok: false; errors: string[] };

const MAX_TITLE_LENGTH = 120;
const MAX_INDUSTRY_LENGTH = 120;
const MAX_RESPONSIBILITIES = 30;
const MAX_REQUIREMENTS = 60;
const MAX_ASSESSMENT_METHODS = 20;
const MAX_LABEL_LENGTH = 240;

/**
 * Converts an organization-provided job brief into a stable, validated role
 * profile. It does not invent qualifications, legal requirements, or licences:
 * the hiring organization must supply role-specific criteria and jurisdiction.
 */
export function buildOccupationalProfile(
  draft: OccupationalProfileDraft
): ProfileBuildResult {
  const errors: string[] = [];
  const title = cleanText(draft.title);
  const industry = cleanText(draft.industry);
  const jurisdiction = cleanText(draft.jurisdiction ?? "");

  if (!title) errors.push("Enter a role title.");
  if (title.length > MAX_TITLE_LENGTH) {
    errors.push(`Role title must be ${MAX_TITLE_LENGTH} characters or fewer.`);
  }
  if (!industry) errors.push("Enter the industry or professional sector.");
  if (industry.length > MAX_INDUSTRY_LENGTH) {
    errors.push(`Industry must be ${MAX_INDUSTRY_LENGTH} characters or fewer.`);
  }
  if (draft.responsibilities.length > MAX_RESPONSIBILITIES) {
    errors.push(`Use no more than ${MAX_RESPONSIBILITIES} responsibilities.`);
  }
  if (draft.requirements.length > MAX_REQUIREMENTS) {
    errors.push(`Use no more than ${MAX_REQUIREMENTS} requirements.`);
  }
  if (draft.assessmentMethods.length > MAX_ASSESSMENT_METHODS) {
    errors.push(`Use no more than ${MAX_ASSESSMENT_METHODS} assessment methods.`);
  }

  const requirements: OccupationalRequirement[] = draft.requirements.map(
    (requirement, index) => ({
      id: `requirement-${index + 1}`,
      label: cleanText(requirement.label),
      kind: requirement.kind,
      importance: requirement.importance,
      evidenceExpectation: requirement.evidenceExpectation,
      ...(requirement.weight === undefined ? {} : { weight: requirement.weight }),
      ...(cleanText(requirement.jurisdiction ?? "")
        ? { jurisdiction: cleanText(requirement.jurisdiction ?? "") }
        : {}),
    })
  );

  const profile: OccupationalProfile = {
    title,
    industry,
    ...(jurisdiction ? { jurisdiction } : {}),
    responsibilities: cleanList(draft.responsibilities),
    requirements,
    assessmentMethods: cleanList(draft.assessmentMethods),
  };

  const profileError = validateOccupationalProfile(profile);
  if (profileError) errors.push(profileError);

  if (requirements.some((item) => item.label.length > MAX_LABEL_LENGTH)) {
    errors.push(`Each requirement label must be ${MAX_LABEL_LENGTH} characters or fewer.`);
  }

  const duplicateLabels = findDuplicates(
    requirements.map((item) => item.label.toLocaleLowerCase())
  );
  if (duplicateLabels.length) {
    errors.push(`Remove duplicate requirements: ${duplicateLabels.join(", ")}.`);
  }

  if (
    requirements.some(
      (item) =>
        item.kind === "professional_license" &&
        item.importance === "required" &&
        !(item.jurisdiction || profile.jurisdiction)
    )
  ) {
    errors.push(
      "A required professional licence must specify its licensing jurisdiction."
    );
  }

  if (errors.length) return { ok: false, errors: [...new Set(errors)] };
  return { ok: true, profile };
}

function cleanText(value: string): string {
  return value.trim().replace(/\\s+/g, " ");
}

function cleanList(values: string[]): string[] {
  return values.map(cleanText).filter(Boolean);
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values.filter(Boolean)) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}
