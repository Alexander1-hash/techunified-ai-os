import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { createAdminClient } from "@/lib/supabase/admin";
import { runTextAI } from "@/lib/ai/text";

export type AutomationTrigger = {
  type: string;
  input?: Record<string, unknown>;
};

export type AutomationStep = {
  id: string;
  type: string;
  config?: Record<string, unknown>;
};

type WorkflowConfiguration = {
  steps?: AutomationStep[];
};

type WorkflowRecord = {
  id: string;
  organization_id: string;
  name: string;
  status: string;
  configuration: WorkflowConfiguration | null;
};

export type ExecutionResult = {
  success: boolean;
  executionId?: string;
  output?: Record<string, unknown>;
  error?: string;
};

export async function executeAutomation(
  workflowId: string,
  organizationId: string,
  trigger: AutomationTrigger
): Promise<ExecutionResult> {
  const supabase = createAdminClient();

  const { data: workflow, error: workflowError } = await supabase
    .from("workflows")
    .select("id, organization_id, name, status, configuration")
    .eq("id", workflowId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (workflowError) {
    return {
      success: false,
      error: workflowError.message,
    };
  }

  if (!workflow) {
    return {
      success: false,
      error: "Workflow not found",
    };
  }

  if (String(workflow.status).toLowerCase() !== "active") {
    return {
      success: false,
      error: "Workflow is not active",
    };
  }

  const typedWorkflow = workflow as WorkflowRecord;

  const configuration = typedWorkflow.configuration ?? {};

  const steps = Array.isArray(configuration.steps)
    ? configuration.steps
    : [];

  const MAX_AUTOMATION_STEPS = 50;
  const MAX_AUTOMATION_INPUT_BYTES = 64 * 1024;
  const MAX_AUTOMATION_OUTPUT_BYTES = 128 * 1024;

  const initialInput = {
    ...(trigger.input ?? {}),
  };

  const initialInputBytes = new TextEncoder().encode(
    JSON.stringify(initialInput)
  ).byteLength;

  if (initialInputBytes > MAX_AUTOMATION_INPUT_BYTES) {
    return {
      success: false,
      error: "Automation input is too large.",
    };
  }

  const { data: execution, error: executionError } = await supabase
    .from("automation_executions")
    .insert({
      organization_id: organizationId,
      workflow_id: workflowId,
      trigger_type: trigger.type,
      status: "running",
      input: initialInput,
    })
    .select("id")
    .single();

  if (executionError || !execution) {
    return {
      success: false,
      error:
        executionError?.message ??
        "Failed to create automation execution",
    };
  }

  if (steps.length > MAX_AUTOMATION_STEPS) {
    await supabase
      .from("automation_executions")
      .update({
        status: "failed",
        error_message: "Workflow exceeds the maximum allowed number of steps.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", execution.id);

    return {
      success: false,
      executionId: execution.id,
      error: "Workflow exceeds the maximum allowed number of steps.",
    };
  }

  let currentInput: Record<string, unknown> = initialInput;

  try {
    for (const step of steps) {
      const {
        data: executionStep,
        error: stepInsertError,
      } = await supabase
        .from("automation_execution_steps")
        .insert({
          execution_id: execution.id,
          step_id: step.id,
          step_type: step.type,
          status: "running",
          input: currentInput,
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (stepInsertError || !executionStep) {
        throw new Error(
          stepInsertError?.message ??
            "Failed to create execution step"
        );
      }

      try {
        const result = await runAutomationStep(
          step,
          currentInput,
          workflowId,
          organizationId
        );

        const resultBytes = new TextEncoder().encode(
          JSON.stringify(result)
        ).byteLength;

        if (resultBytes > MAX_AUTOMATION_OUTPUT_BYTES) {
          throw new Error(
            "Automation step output is too large."
          );
        }

        currentInput = result;

        await supabase
          .from("automation_execution_steps")
          .update({
            status: "completed",
            output: result,
            completed_at: new Date().toISOString(),
          })
          .eq("id", executionStep.id);
      } catch (stepError) {
        const message =
          stepError instanceof Error
            ? stepError.message
            : "Automation step failed";

        await supabase
          .from("automation_execution_steps")
          .update({
            status: "failed",
            error_message: message,
            completed_at: new Date().toISOString(),
          })
          .eq("id", executionStep.id);

        throw new Error(
          `Step ${step.type} failed: ${message}`
        );
      }
    }

    await supabase
      .from("automation_executions")
      .update({
        status: "completed",
        output: currentInput,
        completed_at: new Date().toISOString(),
      })
      .eq("id", execution.id);

    return {
      success: true,
      executionId: execution.id,
      output: currentInput,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Automation execution failed";

    await supabase
      .from("automation_executions")
      .update({
        status: "failed",
        error_message: message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", execution.id);

    return {
      success: false,
      executionId: execution.id,
      error: message,
    };
  }
}

export async function runAutomationStep(
  step: AutomationStep,
  input: Record<string, unknown>,
  workflowId: string,
  organizationId: string
): Promise<Record<string, unknown>> {
  const supabase = createAdminClient();
  const config = step.config ?? {};

  switch (step.type) {
    case "pass_through":
      return {
        ...input,
        action: "pass_through",
      };

    case "create_record": {
      const table = String(config.table ?? "").trim();

      assertWritableAutomationTable(table);

      const rawRecord = isRecord(config.record)
        ? config.record
        : input;

      const record = withOrganizationBoundary(
        rawRecord,
        organizationId
      );

      const { data, error } = await supabase
        .from(table)
        .insert(record)
        .select("*")
        .single();

      if (error) {
        throw new Error(
          `Failed to create record: ${error.message}`
        );
      }

      return {
        ...input,
        action: "create_record",
        table,
        record: data,
      };
    }

    case "update_record": {
      const table = String(config.table ?? "").trim();
      const id = String(config.id ?? "").trim();

      assertWritableAutomationTable(table);

      if (!id) {
        throw new Error(
          "update_record requires a record id"
        );
      }

      const rawRecord = isRecord(config.record)
        ? config.record
        : input;

      const record = withOrganizationBoundary(
        rawRecord,
        organizationId
      );

      const { data, error } = await supabase
        .from(table)
        .update(record)
        .eq("id", id)
        .eq("organization_id", organizationId)
        .select("*")
        .single();

      if (error) {
        throw new Error(
          `Failed to update record: ${error.message}`
        );
      }

      return {
        ...input,
        action: "update_record",
        table,
        record: data,
      };
    }

    case "call_webhook": {
      const url = String(config.url ?? "").trim();

      if (!url) {
        throw new Error(
          "call_webhook requires a webhook URL"
        );
      }

      await assertSafeWebhookUrl(url);

      const method = String(
        config.method ?? "POST"
      ).toUpperCase();

      const allowedMethods = [
        "GET",
        "POST",
        "PUT",
        "PATCH",
      ];

      if (!allowedMethods.includes(method)) {
        throw new Error(
          `Unsupported webhook method: ${method}`
        );
      }

      const headers = buildWebhookHeaders(config.headers);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);

      let response: Response;
      let responseText: string;
      try {
        response = await fetch(url, {
          method,
          headers,
          redirect: "error",
          signal: controller.signal,
          ...(method === "GET"
            ? {}
            : {
                body: JSON.stringify(input),
              }),
        });

        // Keep the same deadline active while reading the response body.
        // Some endpoints send headers quickly but then stall the body stream.
        responseText = await readResponseBodyLimited(
          response,
          50_000
        );
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error("Webhook request timed out.");
        }
        if (controller.signal.aborted) {
          throw new Error("Webhook request timed out.");
        }
        throw new Error(
          error instanceof Error
            ? `Webhook request failed: ${error.message}`
            : "Webhook request failed."
        );
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        throw new Error(
          `Webhook returned ${response.status}: ${responseText.slice(
            0,
            500
          )}`
        );
      }

      let responseData: unknown = responseText;

      try {
        responseData = responseText
          ? JSON.parse(responseText)
          : null;
      } catch {
        // Keep plain-text response.
      }

      return {
        ...input,
        action: "call_webhook",
        webhook: {
          url,
          method,
          status: response.status,
          response: responseData,
        },
      };
    }

    case "update_workflow_status": {
      const status = String(
        config.status ?? ""
      )
        .toLowerCase()
        .trim();

      const allowedStatuses = [
        "draft",
        "active",
        "paused",
        "archived",
      ];

      if (!allowedStatuses.includes(status)) {
        throw new Error(
          `Invalid workflow status: ${status}`
        );
      }

      const { error } = await supabase
        .from("workflows")
        .update({
          status,
        })
        .eq("id", workflowId)
        .eq("organization_id", organizationId);

      if (error) {
        throw new Error(
          `Failed to update workflow status: ${error.message}`
        );
      }

      return {
        ...input,
        action: "update_workflow_status",
        workflowId,
        status,
      };
    }

    case "run_ai_analysis": {
      const prompt = String(
        config.prompt ?? ""
      ).trim();

      const model =
        String(config.model ?? "").trim() ||
        undefined;

      if (!prompt) {
        throw new Error(
          "run_ai_analysis requires a prompt"
        );
      }

      if (prompt.length > 4000) {
        throw new Error(
          "run_ai_analysis prompt is too long."
        );
      }

      const result = await runTextAI({
        model,
        system:
          "You are the AI analysis engine inside TechUnified AI OS. Analyze the supplied workflow data accurately and return useful, concise business analysis. Do not invent facts that are not present in the input.",
        prompt: [
          prompt,
          "",
          "Workflow input:",
          JSON.stringify(input, null, 2),
        ].join("\n"),
      });

      return {
        ...input,
        action: "run_ai_analysis",
        analysis: result.text,
        model: result.model,
      };
    }

    case "generate_ai_content": {
      const prompt = String(
        config.prompt ?? ""
      ).trim();

      const model =
        String(config.model ?? "").trim() ||
        undefined;

      const outputFormat =
        String(
          config.outputFormat ?? "text"
        ).trim() || "text";

      if (!prompt) {
        throw new Error(
          "generate_ai_content requires a prompt"
        );
      }

      if (prompt.length > 4000) {
        throw new Error(
          "generate_ai_content prompt is too long."
        );
      }

      if (outputFormat.length > 100) {
        throw new Error(
          "generate_ai_content output format is too long."
        );
      }

      const result = await runTextAI({
        model,
        system:
          "You are the AI content generation engine inside TechUnified AI OS. Generate polished content from the supplied instructions and workflow data. Follow the requested output format and do not invent unsupported business facts.",
        prompt: [
          prompt,
          "",
          `Requested output format: ${outputFormat}`,
          "",
          "Workflow input:",
          JSON.stringify(input, null, 2),
        ].join("\n"),
      });

      return {
        ...input,
        action: "generate_ai_content",
        content: result.text,
        model: result.model,
        outputFormat,
      };
    }

    case "create_task":
      throw new Error(
        "create_task is not connected to a task table yet"
      );

    case "send_notification":
      throw new Error(
        "send_notification is not connected to a notification provider yet"
      );

    default:
      throw new Error(
        `Unsupported automation step type: ${step.type}`
      );
  }
}

const AUTOMATION_WRITABLE_TABLES = new Set([
  "business_action_runs",
  "business_data_sources",
  "business_kpis",
  "business_objectives",
  "business_outcomes",
  "business_source_records",
  "customers",
  "leads",
]);

function assertWritableAutomationTable(table: string) {
  if (!AUTOMATION_WRITABLE_TABLES.has(table)) {
    throw new Error(
      `Automation writes are not permitted for table: ${table}`
    );
  }
}

function withOrganizationBoundary(
  record: Record<string, unknown>,
  organizationId: string
) {
  if (
    "organization_id" in record &&
    record.organization_id !== organizationId
  ) {
    throw new Error(
      "Automation record organization does not match the workflow organization."
    );
  }

  return {
    ...record,
    organization_id: organizationId,
  };
}

function buildWebhookHeaders(rawHeaders: unknown) {
  const MAX_HEADERS = 50;
  const MAX_HEADER_NAME_LENGTH = 200;
  const MAX_HEADER_VALUE_LENGTH = 2_000;
  const MAX_TOTAL_HEADER_BYTES = 16 * 1024;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (!isRecord(rawHeaders)) {
    return headers;
  }

  const entries = Object.entries(rawHeaders);

  if (entries.length > MAX_HEADERS) {
    throw new Error("Webhook request contains too many headers.");
  }

  const forbiddenHeaders = new Set([
    "connection",
    "content-length",
    "host",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
  ]);

  let totalBytes = new TextEncoder().encode(
    JSON.stringify(headers)
  ).byteLength;

  for (const [rawKey, rawValue] of entries) {
    const key = rawKey.trim();

    if (!key || key.length > MAX_HEADER_NAME_LENGTH) {
      throw new Error("Webhook header name is invalid or too long.");
    }

    if (forbiddenHeaders.has(key.toLowerCase())) {
      throw new Error(`Webhook header is not allowed: ${key}`);
    }

    const value = String(rawValue);

    if (value.length > MAX_HEADER_VALUE_LENGTH) {
      throw new Error(`Webhook header value is too long: ${key}`);
    }

    totalBytes += new TextEncoder().encode(
      `${key}: ${value}`
    ).byteLength;

    if (totalBytes > MAX_TOTAL_HEADER_BYTES) {
      throw new Error("Webhook headers are too large.");
    }

    headers[key] = value;
  }

  return headers;
}

async function assertSafeWebhookUrl(rawUrl: string) {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("call_webhook requires a valid URL.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Webhook URLs must use HTTPS.");
  }

  if (parsed.username || parsed.password) {
    throw new Error("Webhook URLs must not contain embedded credentials.");
  }

  const hostname = parsed.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "metadata.google.internal" ||
    hostname === "metadata.google" ||
    hostname === "169.254.169.254" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  ) {
    throw new Error("Webhook destination is not allowed.");
  }

  const addresses = await lookup(hostname, {
    all: true,
    verbatim: true,
  });

  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("Webhook destination resolves to a private or restricted address.");
  }
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase();

  if (isIP(normalized) === 4) {
    return isNonPublicIPv4(normalized);
  }

  if (isIP(normalized) !== 6) return true;

  // Convert IPv4-mapped IPv6 addresses before applying the IPv4 policy.
  const mappedDotted = normalized.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mappedDotted) return isNonPublicIPv4(mappedDotted[1]);

  const groups = expandIPv6(normalized);
  if (!groups) return true;

  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    const high = groups[6];
    const low = groups[7];
    const ipv4 = [
      (high >> 8) & 255,
      high & 255,
      (low >> 8) & 255,
      low & 255,
    ].join(".");
    return isNonPublicIPv4(ipv4);
  }

  // Only permit globally routable IPv6 global-unicast space (2000::/3).
  // This blocks unspecified, loopback, link-local, ULA, multicast, and special-use ranges.
  const first = groups[0];
  if (first < 0x2000 || first > 0x3fff) return true;

  // Documentation and special-purpose allocations are not public destinations.
  if (groups[0] === 0x2001 && (groups[1] === 0x0db8 || (groups[1] & 0xfff0) === 0x0010 || (groups[1] & 0xfff0) === 0x0020)) {
    return true;
  }

  return false;
}

function isNonPublicIPv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b, c] = parts;
  return (
    a === 0 ||                         // Current network / unspecified
    a === 10 ||                        // Private
    a === 127 ||                       // Loopback
    (a === 100 && b >= 64 && b <= 127) || // Carrier-grade NAT
    (a === 169 && b === 254) ||        // Link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // Private
    (a === 192 && b === 0 && c === 0) || // IETF protocol assignments
    (a === 192 && b === 0 && c === 2) || // Documentation
    (a === 192 && b === 88 && c === 99) || // Deprecated 6to4 relay
    (a === 192 && b === 168) ||        // Private
    (a === 198 && (b === 18 || b === 19)) || // Benchmarking
    (a === 198 && b === 51 && c === 100) || // Documentation
    (a === 203 && b === 0 && c === 113) || // Documentation
    a >= 224                            // Multicast and reserved
  );
}

function expandIPv6(address: string): number[] | null {
  const normalized = address.toLowerCase().split("%")[0];
  const halves = normalized.split("::");
  if (halves.length > 2) return null;

  const parseHalf = (half: string) => half ? half.split(":").map((group) => {
    if (!/^[0-9a-f]{1,4}$/.test(group)) throw new Error("Invalid IPv6 group");
    return Number.parseInt(group, 16);
  }) : [];

  try {
    const left = parseHalf(halves[0]);
    const right = parseHalf(halves[1] ?? "");
    const missing = 8 - left.length - right.length;
    if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
    return [...left, ...Array(missing).fill(0), ...right];
  } catch {
    return null;
  }
}

async function readResponseBodyLimited(
  response: Response,
  maxBytes: number
) {
  if (!response.body) {
    const text = await response.text();
    return text.slice(0, maxBytes);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      totalBytes += value.byteLength;

      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new Error("Webhook response body is too large.");
      }

      text += decoder.decode(value, { stream: true });
    }

    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
