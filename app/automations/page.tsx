"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  Play,
  Plus,
  RefreshCw,
  Settings2,
  Workflow,
  XCircle,
} from "lucide-react";

type Workflow = {
  id: string;
  name: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type Execution = {
  id: string;
  workflow_id: string;
  trigger_type: string;
  status: string;
  created_at: string;
  started_at: string;
  completed_at?: string | null;
  workflows?: {
    id: string;
    name: string;
  } | null;
};

export default function AutomationsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function loadData() {
    try {
      setLoading(true);

      const [workflowResponse, executionResponse] = await Promise.all([
        fetch("/api/workflows"),
        fetch("/api/automations/executions"),
      ]);

      if (workflowResponse.ok) {
        const workflowData = await workflowResponse.json();
        setWorkflows(workflowData.workflows ?? []);
      }

      if (executionResponse.ok) {
        const executionData = await executionResponse.json();
        setExecutions(executionData.executions ?? []);
      }
    } catch {
      setMessage("Unable to load automation data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function runAutomation(workflowId: string) {
    try {
      setRunningId(workflowId);
      setMessage("");

      const response = await fetch("/api/automations/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workflowId,
          input: {
            source: "manual",
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(data.error ?? "Automation failed.");
        return;
      }

      setMessage("Automation executed successfully.");
      await loadData();
    } catch {
      setMessage("Unable to execute automation.");
    } finally {
      setRunningId(null);
    }
  }

  const activeCount = workflows.filter(
    (workflow) => workflow.status.toLowerCase() === "active"
  ).length;

  const draftCount = workflows.filter(
    (workflow) => workflow.status.toLowerCase() !== "active"
  ).length;

  const successfulExecutions = executions.filter(
    (execution) => execution.status.toLowerCase() === "completed"
  ).length;

  const failedExecutions = executions.filter(
    (execution) => execution.status.toLowerCase() === "failed"
  ).length;

  return (
    <main className="min-h-screen bg-white px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-600">
              <Bot className="h-4 w-4" />
              AI & Automation
            </div>

            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Automations
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Build and manage automated business processes inside TechUnified.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>

            <Link
              href="/workflows/new"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Create automation
            </Link>
          </div>
        </header>

        {message && (
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {message}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Workflow className="h-5 w-5" />}
            label="Total automations"
            value={workflows.length}
          />

          <StatCard
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="Active"
            value={activeCount}
          />

          <StatCard
            icon={<Clock3 className="h-5 w-5" />}
            label="Drafts"
            value={draftCount}
          />

          <StatCard
            icon={<Activity className="h-5 w-5" />}
            label="Successful runs"
            value={successfulExecutions}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-semibold">Your automations</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Organization-scoped workflows managed by TechUnified.
                </p>
              </div>

              <Link
                href="/workflows"
                className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                View workflows
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {loading ? (
              <div className="px-5 py-12 text-center text-sm text-slate-500">
                Loading automations...
              </div>
            ) : workflows.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                  <Workflow className="h-6 w-6 text-slate-500" />
                </div>

                <h3 className="font-medium">No automations yet</h3>

                <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                  Create your first automation to start connecting business
                  events, logic, and actions.
                </p>

                <Link
                  href="/workflows/new"
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Create automation
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {workflows.map((workflow) => {
                  const active =
                    workflow.status.toLowerCase() === "active";

                  return (
                    <div
                      key={workflow.id}
                      className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                            <Workflow className="h-4 w-4 text-slate-600" />
                          </div>

                          <div className="min-w-0">
                            <Link
                              href={`/workflows/${workflow.id}`}
                              className="block truncate font-medium hover:text-blue-600"
                            >
                              {workflow.name}
                            </Link>

                            <p className="mt-1 truncate text-sm text-slate-500">
                              {workflow.description || "No description"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {workflow.status}
                        </span>

                        <button
                          type="button"
                          disabled={!active || runningId === workflow.id}
                          onClick={() => runAutomation(workflow.id)}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Play className="h-3.5 w-3.5" />
                          {runningId === workflow.id
                            ? "Running..."
                            : "Run"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold">Execution activity</h2>
              <p className="mt-1 text-xs text-slate-500">
                Recent automation runs.
              </p>
            </div>

            <div className="px-5 py-4">
              <div className="mb-5 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-emerald-50 p-3">
                  <div className="text-xs text-emerald-700">
                    Completed
                  </div>
                  <div className="mt-1 text-xl font-semibold text-emerald-900">
                    {successfulExecutions}
                  </div>
                </div>

                <div className="rounded-lg bg-red-50 p-3">
                  <div className="text-xs text-red-700">Failed</div>
                  <div className="mt-1 text-xl font-semibold text-red-900">
                    {failedExecutions}
                  </div>
                </div>
              </div>

              {executions.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  No executions yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {executions.slice(0, 8).map((execution) => (
                    <Link
                      key={execution.id}
                      href={`/automations/executions/${execution.id}`}
                      className="flex items-center justify-between rounded-lg border border-slate-100 p-3 transition hover:border-slate-200 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {execution.workflows?.name ??
                            "Automation execution"}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {execution.trigger_type}
                        </p>
                      </div>

                      {execution.status.toLowerCase() === "completed" ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      ) : execution.status.toLowerCase() === "failed" ? (
                        <XCircle className="h-4 w-4 shrink-0 text-red-600" />
                      ) : (
                        <Clock3 className="h-4 w-4 shrink-0 text-amber-600" />
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-start gap-3">
            <Settings2 className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />

            <div>
              <h2 className="font-medium">TechUnified Automation Engine</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Automations are executed by TechUnified&apos;s native
                automation engine. Workflows, triggers, execution history,
                conditions, and actions are managed within your organization.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        {icon}
      </div>

      <p className="text-sm text-slate-500">{label}</p>

      <p className="mt-1 text-2xl font-semibold tracking-tight">
        {value}
      </p>
    </div>
  );
        }
