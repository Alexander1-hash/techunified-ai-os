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

  if (workflow.status?.toLowerCase() !== "active") {
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
      error: executionError?.message ?? "Failed to create automation execution",
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
      const stepStartedAt = new Date().toISOString();

      const { data: executionStep, error: stepInsertError } = await supabase
        .from("automation_execution_steps")
        .insert({
          execution_id: execution.id,
          step_id: step.id,
          step_type: step.type,
          status: "running",
          input: currentInput,
          started_at: stepStartedAt,
        })
        .select("id")
        .single();

      if (stepInsertError || !executionStep) {
        throw new Error(
          stepInsertError?.message ?? "Failed to create execution step"
        );
      }

      try {
        const result = await runAutomationStep(step, currentInput);

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
      error instanceof Error ? error.message : "Automation execution failed";

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
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const config = step.config ?? {};

  switch (step.type) {
    case "pass_through":
      return {
        ...input,
      };

    case "create_record":
      return {
        ...input,
        action: "create_record",
        record: config.record ?? {},
      };

    case "update_record":
      return {
        ...input,
        action: "update_record",
        record: config.record ?? {},
      };

    case "create_task":
      return {
        ...input,
        action: "create_task",
        task: config.task ?? {},
      };

    case "send_notification":
      return {
        ...input,
        action: "send_notification",
        notification: config.notification ?? {},
      };

    case "run_ai_analysis":
      return {
        ...input,
        action: "run_ai_analysis",
        analysis: {
          requested: true,
          prompt: config.prompt ?? "",
        },
      };

    case "generate_ai_content":
      return {
        ...input,
        action: "generate_ai_content",
        content: {
          requested: true,
          prompt: config.prompt ?? "",
        },
      };

    case "call_webhook":
      return {
        ...input,
        action: "call_webhook",
        webhook: {
          url: config.url ?? "",
          method: config.method ?? "POST",
        },
      };

    case "update_workflow_status":
      return {
        ...input,
        action: "update_workflow_status",
        status: config.status ?? "active",
      };

    default:
      throw new Error(`Unsupported automation step type: ${step.type}`);
  }
      }
