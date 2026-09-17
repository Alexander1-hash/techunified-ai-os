import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type ExecutionStep = {
  id: string;
  step_id: string;
  step_type: string;
  status: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
};

type Execution = {
  id: string;
  workflow_id: string;
  trigger_type: string;
  status: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  workflows:
    | {
        id: string;
        name: string;
        description: string;
        status: string;
      }
    | null;
};

export default async function AutomationExecutionPage({
  params,
}: PageProps) {
  const { id } = await params;

  if (!id) {
    notFound();
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.organization_id) {
    notFound();
  }

  const { data: execution, error: executionError } = await supabase
    .from("automation_executions")
    .select(
      `
        id,
        workflow_id,
        trigger_type,
        status,
        input,
        output,
        error_message,
        started_at,
        completed_at,
        created_at,
        workflows (
          id,
          name,
          description,
          status
        )
      `
    )
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();

  if (executionError || !execution) {
    notFound();
  }

  const { data: steps } = await supabase
    .from("automation_execution_steps")
    .select(
      `
        id,
        step_id,
        step_type,
        status,
        input,
        output,
        error_message,
        started_at,
        completed_at
      `
    )
    .eq("execution_id", id)
    .order("created_at", { ascending: true });

  const typedExecution = execution as Execution;
  const typedSteps = (steps ?? []) as ExecutionStep[];

  const status = typedExecution.status.toLowerCase();

  const statusLabel =
    status === "completed"
      ? "Completed"
      : status === "failed"
        ? "Failed"
        : status === "running"
          ? "Running"
          : typedExecution.status;

  return (
    <main className="min-h-screen bg-white px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/automations"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              ← Back to Automations
            </Link>

            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              Automation Execution
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Detailed execution history for this automation run.
            </p>
          </div>

          <div
            className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-medium ${
              status === "completed"
                ? "bg-emerald-50 text-emerald-700"
                : status === "failed"
                  ? "bg-red-50 text-red-700"
                  : status === "running"
                    ? "bg-blue-50 text-blue-700"
                    : "bg-slate-100 text-slate-700"
            }`}
          >
            {statusLabel}
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Workflow
              </p>
              <p className="mt-1 font-medium text-slate-900">
                {typedExecution.workflows?.name ?? "Unknown workflow"}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Trigger
              </p>
              <p className="mt-1 font-medium text-slate-900">
                {typedExecution.trigger_type}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Started
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {new Date(typedExecution.started_at).toLocaleString()}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Completed
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {typedExecution.completed_at
                  ? new Date(
                      typedExecution.completed_at
                    ).toLocaleString()
                  : "—"}
              </p>
            </div>
          </div>
        </section>

        {typedExecution.error_message && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <h2 className="text-sm font-semibold text-red-800">
              Execution Error
            </h2>
            <p className="mt-2 text-sm text-red-700">
              {typedExecution.error_message}
            </p>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Execution Steps</h2>
              <p className="mt-1 text-sm text-slate-500">
                {typedSteps.length} step
                {typedSteps.length === 1 ? "" : "s"} executed.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {typedSteps.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                No execution steps were recorded.
              </div>
            ) : (
              typedSteps.map((step, index) => {
                const stepStatus = step.status.toLowerCase();

                return (
                  <div
                    key={step.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Step {index + 1}: {step.step_type}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          ID: {step.step_id}
                        </p>
                      </div>

                      <span
                        className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${
                          stepStatus === "completed"
                            ? "bg-emerald-50 text-emerald-700"
                            : stepStatus === "failed"
                              ? "bg-red-50 text-red-700"
                              : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {step.status}
                      </span>
                    </div>

                    {step.error_message && (
                      <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                        {step.error_message}
                      </div>
                    )}

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Input
                        </p>

                        <pre className="max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
                          {JSON.stringify(step.input ?? {}, null, 2)}
                        </pre>
                      </div>

                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Output
                        </p>

                        <pre className="max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
                          {JSON.stringify(step.output ?? {}, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Execution Input</h2>

            <pre className="mt-4 max-h-80 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
              {JSON.stringify(typedExecution.input ?? {}, null, 2)}
            </pre>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Execution Output</h2>

            <pre className="mt-4 max-h-80 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
              {JSON.stringify(typedExecution.output ?? {}, null, 2)}
            </pre>
          </div>
        </section>
      </div>
    </main>
  );
  }
