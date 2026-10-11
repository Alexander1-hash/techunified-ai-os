import type { OccupationalProfile } from "./intelligence";

/**
 * Contracts for authorized talent-source integrations.
 *
 * Adapters must use a provider's approved API or other explicitly permitted
 * access method. This module intentionally contains no web scraper and does
 * not grant permission to collect or retain candidate data.
 */
export interface TalentSearchRequest {
  role: Pick<OccupationalProfile, "title" | "industry" | "jurisdiction" | "responsibilities" | "requirements">;
  query: string;
  location?: string;
  limit?: number;
}

export interface TalentSourceCandidate {
  /** Stable identifier supplied by the source; do not use email as an ID. */
  sourceCandidateId: string;
  /** Display name returned by the authorized source, if available. */
  displayName?: string;
  /** Public or provider-hosted profile URL, if supplied by the source. */
  profileUrl?: string;
  /** Short, job-relevant summary. Avoid copying full profile pages. */
  summary?: string;
  /** Source-provided job-relevant skill tags only. */
  skills?: string[];
}

export interface TalentSourceSearchResult {
  candidates: TalentSourceCandidate[];
  /** Identifier of the source used to retrieve these candidates. */
  sourceId: string;
  retrievedAt: string;
}

export interface AuthorizedTalentSource {
  id: string;
  displayName: string;
  enabled: boolean;
  /** Organization administrator has reviewed and approved this integration. */
  organizationApproved: boolean;
  /** Provider-specific contract, API permission, and usage policy are satisfied. */
  accessMethodAuthorized: boolean;
  search(request: TalentSearchRequest): Promise<TalentSourceSearchResult>;
}

export interface TalentDiscoveryInput {
  processingAuthorized: boolean;
  /** Authorization must be established before candidate data is searched. */
  authorizationReference?: string;
  request: TalentSearchRequest;
  sources: AuthorizedTalentSource[];
}

export interface TalentDiscoverySourceStatus {
  sourceId: string;
  status: "searched" | "skipped" | "failed";
  candidateCount: number;
  message?: string;
}

export interface TalentDiscoveryResult {
  status: "completed" | "not_authorized" | "no_approved_sources" | "invalid_request";
  candidates: Array<TalentSourceCandidate & {
    sourceId: string;
    sourceDisplayName: string;
    retrievedAt: string;
  }>;
  sources: TalentDiscoverySourceStatus[];
  explanation: string;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const MAX_QUERY_LENGTH = 500;
const MAX_SUMMARY_LENGTH = 1200;
const MAX_SKILLS = 40;

/**
 * Searches only explicitly approved, enabled adapters. Each provider adapter
 * is responsible for its own terms, API permissions, rate limits, and consent
 * requirements. Candidate matches are leads for human review, never decisions.
 */
export async function discoverTalent(
  input: TalentDiscoveryInput
): Promise<TalentDiscoveryResult> {
  if (!input.processingAuthorized || !input.authorizationReference?.trim()) {
    return {
      status: "not_authorized",
      candidates: [],
      sources: input.sources.map((source) => ({
        sourceId: source.id,
        status: "skipped",
        candidateCount: 0,
        message: "Candidate search requires documented processing authorization.",
      })),
      explanation: "No source was contacted because documented authorization was not supplied.",
    };
  }

  const query = input.request.query.trim();
  if (!query || query.length > MAX_QUERY_LENGTH) {
    return {
      status: "invalid_request",
      candidates: [],
      sources: [],
      explanation: "Provide a job-related search query of 1 to 500 characters.",
    };
  }

  const limit = Math.max(1, Math.min(MAX_LIMIT, Math.floor(input.request.limit ?? DEFAULT_LIMIT)));
  const request: TalentSearchRequest = { ...input.request, query, limit };
  const approvedSources = input.sources.filter(
    (source) => source.enabled && source.organizationApproved && source.accessMethodAuthorized
  );

  if (approvedSources.length === 0) {
    return {
      status: "no_approved_sources",
      candidates: [],
      sources: input.sources.map((source) => ({
        sourceId: source.id,
        status: "skipped" as const,
        candidateCount: 0,
        message: "Source is disabled, not organization-approved, or lacks authorized access.",
      })),
      explanation: "No approved talent-source integrations are configured.",
    };
  }

  const candidates: TalentDiscoveryResult["candidates"] = [];
  const statuses: TalentDiscoverySourceStatus[] = [];
  const seen = new Set<string>();

  for (const source of approvedSources) {
    try {
      const result = await source.search(request);
      const retrievedAt = isValidDate(result.retrievedAt)
        ? new Date(result.retrievedAt).toISOString()
        : new Date().toISOString();
      let sourceCount = 0;

      for (const candidate of result.candidates.slice(0, limit)) {
        const sourceCandidateId = candidate.sourceCandidateId.trim();
        if (!sourceCandidateId) continue;
        const dedupeKey = `${source.id}:${sourceCandidateId}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        candidates.push({
          sourceCandidateId,
          sourceId: source.id,
          sourceDisplayName: source.displayName,
          retrievedAt,
          ...(cleanOptional(candidate.displayName, 160) ? { displayName: cleanOptional(candidate.displayName, 160) } : {}),
          ...(cleanUrl(candidate.profileUrl) ? { profileUrl: cleanUrl(candidate.profileUrl) } : {}),
          ...(cleanOptional(candidate.summary, MAX_SUMMARY_LENGTH) ? { summary: cleanOptional(candidate.summary, MAX_SUMMARY_LENGTH) } : {}),
          ...(Array.isArray(candidate.skills)
            ? { skills: candidate.skills.slice(0, MAX_SKILLS).map((skill) => cleanOptional(skill, 100)).filter((skill): skill is string => Boolean(skill)) }
            : {}),
        });
        sourceCount += 1;
      }

      statuses.push({ sourceId: source.id, status: "searched", candidateCount: sourceCount });
    } catch {
      // Do not return provider error payloads; they can contain secrets or PII.
      statuses.push({
        sourceId: source.id,
        status: "failed",
        candidateCount: 0,
        message: "The talent source could not be searched. Check its server-side integration logs.",
      });
    }
  }

  return {
    status: "completed",
    candidates,
    sources: [
      ...input.sources.filter((source) => !approvedSources.includes(source)).map((source) => ({
        sourceId: source.id,
        status: "skipped" as const,
        candidateCount: 0,
        message: "Source is disabled, not organization-approved, or lacks authorized access.",
      })),
      ...statuses,
    ],
    explanation: "Results are sourced leads, not verified qualifications or hiring recommendations. Review provenance, verify credentials, and obtain human approval before decisions.",
  };
}

function cleanOptional(value: string | undefined, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[\\u0000-\\u001f\\u007f]/g, " ").replace(/\\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, maxLength) : undefined;
}

function cleanUrl(value: string | undefined): string | undefined {
  const cleaned = cleanOptional(value, 2048);
  if (!cleaned) return undefined;
  try {
    const url = new URL(cleaned);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function isValidDate(value: string): boolean {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
