import { createAdminClient } from "@/lib/supabase/admin";

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

type ExecutionResult = {
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

  const configuration =
    (workflow.configuration as WorkflowConfiguration | null) ?? {};

  const steps = Array.isArray(configuration.steps)
    ? configuration.steps
    : [];

  let currentInput: Record<string, unknown> = {
    ...(trigger.input ?? {}),
  };

  try {
    for (const step of steps) {
      const { data: executionStep, error: stepInsertError } =
        await supabase
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

        throw new Error(message);
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

async function runAutomationStep(
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
      };

    case "create_record": {
      const table = String(config.table ?? "").trim();
      const record =
        config.record &&
        typeof config.record === "object" &&
        !Array.isArray(config.record)
          ? (config.record as Record<string, unknown>)
          : {};

      if (!table) {
        throw new Error(
          "create_record requires a table name"
        );
      }

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
        record: data,
        action: "create_record",
        table,
      };
    }

    case "update_record": {
      const table = String(config.table ?? "").trim();
      const id = config.id;

      const record =
        config.record &&
        typeof config.record === "object" &&
        !Array.isArray(config.record)
          ? (config.record as Record<string, unknown>)
          : {};

      if (!table) {
        throw new Error(
          "update_record requires a table name"
        );
      }

      if (!id) {
        throw new Error(
          "update_record requires a record id"
        );
      }

      const { data, error } = await supabase
        .from(table)
        .update(record)
        .eq("id", id)
        .select("*")
        .single();

      if (error) {
        throw new Error(
          `Failed to update record: ${error.message}`
        );
      }

      return {
        ...input,
        record: data,
        action: "update_record",
        table,
      };
    }

    case "call_webhook": {
      const url = String(config.url ?? "").trim();
      const method = String(config.method ?? "POST").toUpperCase();

      if (!url) {
        throw new Error(
          "call_webhook requires a webhook URL"
        );
      }

      if (!["GET", "POST", "PUT", "PATCH"].includes(method)) {
        throw new Error(
          `Unsupported webhook method: ${method}`
        );
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (
        config.headers &&
        typeof config.headers === "object" &&
        !Array.isArray(config.headers)
      ) {
        for (const [key, value] of Object.entries(
          config.headers as Record<string, unknown>
        )) {
          if (typeof value === "string") {
            headers[key] = value;
          }
        }
      }

      const response = await fetch(url, {
        method,
        headers,
        ...(method === "GET"
          ? {}
          : {
              body: JSON.stringify(input),
            }),
      });

      const responseText = await response.text();

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
        config.status ?? "active"
      ).toLowerCase();

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
          updated_at: new Date().toISOString(),
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

    case "create_task":
      throw new Error(
        "create_task is not connected to a task table yet"
      );

    case "send_notification":
      throw new Error(
        "send_notification is not connected to a notification provider yet"
      );

    case "run_ai_analysis":
      throw new Error(
        "run_ai_analysis will be connected to the existing TechUnified AI service"
      );

    case "generate_ai_content":
      throw new Error(
        "generate_ai_content will be connected to the existing TechUnified AI service"
      );

    default:
      throw new Error(
        `Unsupported automation step type: ${step.type}`
      );
  }
      }
