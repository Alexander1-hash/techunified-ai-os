export const OPERATIONS_SNAPSHOT_FORMAT = "techunified-ai-os-operations-snapshot" as const;
export const OPERATIONS_SNAPSHOT_VERSION = 1 as const;
export const OPERATIONS_SNAPSHOT_MAX_BYTES = 2 * 1024 * 1024;

export type OperationsSnapshotPayload = {
  schemaVersion: typeof OPERATIONS_SNAPSHOT_VERSION;
  exportedAt: string;
  product: string;
  summary: Record<string, unknown>;
  modules: Array<{ name: string; state: string; detail: string }>;
  reliabilityFindings: unknown[];
  incidents: unknown[];
  limitations: string[];
};

export type OperationsSnapshotEnvelope = {
  format: typeof OPERATIONS_SNAPSHOT_FORMAT;
  algorithm: "SHA-256";
  digest: string;
  payload: OperationsSnapshotPayload;
  integrityNote: string;
};

export type SnapshotVerification = {
  valid: boolean;
  digestMatches: boolean;
  errors: string[];
  warnings: string[];
  payload?: OperationsSnapshotPayload;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validPayload(value: unknown): value is OperationsSnapshotPayload {
  if (!isObject(value)) return false;
  return value.schemaVersion === OPERATIONS_SNAPSHOT_VERSION
    && typeof value.exportedAt === "string" && Number.isFinite(Date.parse(value.exportedAt))
    && value.product === "TechUnifiedAIOS Intelligence Operations Center"
    && isObject(value.summary)
    && Array.isArray(value.modules) && value.modules.every(module => isObject(module)
      && typeof module.name === "string" && typeof module.state === "string" && typeof module.detail === "string")
    && Array.isArray(value.reliabilityFindings)
    && Array.isArray(value.incidents)
    && Array.isArray(value.limitations) && value.limitations.every(item => typeof item === "string");
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

/** Hash detects accidental changes; it does not prove who created a file or prevent a deliberate rewrite. */
export async function createOperationsSnapshotEnvelope(payload: OperationsSnapshotPayload): Promise<OperationsSnapshotEnvelope> {
  if (!validPayload(payload)) throw new Error("Operations snapshot payload failed schema validation.");
  const canonicalPayload = JSON.stringify(payload);
  return {
    format: OPERATIONS_SNAPSHOT_FORMAT,
    algorithm: "SHA-256",
    digest: await sha256(canonicalPayload),
    payload,
    integrityNote: "Digest detects accidental changes only. This is not a digital signature, identity proof, or tamper-proof audit record.",
  };
}

export async function verifyOperationsSnapshotText(text: string): Promise<SnapshotVerification> {
  const errors: string[] = [];
  const warnings = [
    "A matching digest does not authenticate the exporter; anyone can edit a file and recalculate its digest.",
    "Snapshot content is a point-in-time export and may contain browser-local, user-editable operational data.",
    "Import verification does not write to or overwrite live incident or audit history.",
  ];
  if (new TextEncoder().encode(text).byteLength > OPERATIONS_SNAPSHOT_MAX_BYTES) {
    return { valid: false, digestMatches: false, errors: ["File exceeds the 2 MiB verification limit."], warnings };
  }

  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch { return { valid: false, digestMatches: false, errors: ["File is not valid JSON."], warnings }; }

  if (!isObject(parsed)) return { valid: false, digestMatches: false, errors: ["Snapshot envelope must be a JSON object."], warnings };
  if (parsed.format !== OPERATIONS_SNAPSHOT_FORMAT) errors.push("Unsupported snapshot format.");
  if (parsed.algorithm !== "SHA-256") errors.push("Unsupported digest algorithm.");
  if (typeof parsed.digest !== "string" || !/^[a-f0-9]{64}$/.test(parsed.digest)) errors.push("Digest is missing or malformed.");
  if (!validPayload(parsed.payload)) errors.push("Payload is missing required fields or has an unsupported schema.");
  if (errors.length) return { valid: false, digestMatches: false, errors, warnings };

  const expected = await sha256(JSON.stringify(parsed.payload));
  const digestMatches = expected === parsed.digest;
  if (!digestMatches) errors.push("Digest mismatch: payload changed after the digest was generated.");
  return {
    valid: errors.length === 0 && digestMatches,
    digestMatches,
    errors,
    warnings,
    ...(validPayload(parsed.payload) ? { payload: parsed.payload } : {}),
  };
}
