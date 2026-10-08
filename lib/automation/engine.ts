import { lookup } from "node:dns/promises";
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

  const { data: execution, error: executionError } = await supabase
    .from("automation_executions")
    .insert({
      organization_id: organizationId,
      workflow_id: workflowId,
      trigger_type: trigger.type,
      status: "running",
      input: trigger.input ?? {},
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

  const configuration = typedWorkflow.configuration ?? {};

  const steps = Array.isArray(configuration.steps)
    ? configuration.steps
    : [];

  const MAX_AUTOMATION_STEPS = 50;
  const MAX_AUTOMATION_INPUT_BYTES = 64 * 1024;

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

  let currentInput: Record<string, unknown> = {
    ...(trigger.input ?? {}),
  };

  if (JSON.stringify(currentInput).length > MAX_AUTOMATION_INPUT_BYTES) {
    await supabase
      .from("automation_executions")
      .update({
        status: "failed",
        error_message: "Automation input is too large.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", execution.id);

    return {
      success: false,
      executionId: execution.id,
      error: "Automation input is too large.",
    };
  }

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

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (isRecord(config.headers)) {
        for (const [key, value] of Object.entries(
          config.headers
        )) {
          headers[key] = String(value);
        }
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);

      let response: Response;
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
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
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

      const responseText = (await response.text()).slice(0, 50_000);

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

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase();

  if (normalized.includes(":")) {
    return (
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb") ||
      normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:192.168.")
    );
  }

  const parts = normalized.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 0
  );
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
