"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Loader2,
  Play,
  Plus,
  Save,
  Trash2,
  Workflow,
} from "lucide-react"
import Link from "next/link"

import { createClient } from "@/lib/supabase/client"
import { Card, PageHeader } from "@/components/ui"

type Step = {
  id: string
  type: string
  config: Record<string, unknown>
}

type WorkflowConfiguration = {
  trigger?: {
    type: string
    config?: Record<string, unknown>
  }
  steps?: Step[]
}

type WorkflowData = {
  id: string
  name: string
  description: string
  status: string
  configuration: WorkflowConfiguration | null
  created_at: string
  updated_at: string
}

const STEP_TYPES = [
  {
    value: "pass_through",
    label: "Pass Through",
    description: "Continue the workflow without changing the data.",
  },
  {
    value: "create_record",
    label: "Create Record",
    description: "Prepare a new business record.",
  },
  {
    value: "update_record",
    label: "Update Record",
    description: "Prepare an update to an existing record.",
  },
  {
    value: "create_task",
    label: "Create Task",
    description: "Create a task for the business.",
  },
  {
    value: "send_notification",
    label: "Send Notification",
    description: "Prepare an internal notification.",
  },
  {
    value: "run_ai_analysis",
    label: "Run AI Analysis",
    description: "Run an AI analysis step.",
  },
  {
    value: "generate_ai_content",
    label: "Generate AI Content",
    description: "Generate content with AI.",
  },
  {
    value: "call_webhook",
    label: "Call Webhook",
    description: "Send workflow data to an external webhook.",
  },
  {
    value: "update_workflow_status",
    label: "Update Workflow Status",
    description: "Change the workflow status.",
  },
]

const TRIGGERS = [
  {
    value: "manual",
    label: "Manual",
    description: "Run this workflow manually.",
  },
  {
    value: "webhook",
    label: "Webhook",
    description: "Run when the workflow webhook receives data.",
  },
]

function makeStep(type = "pass_through"): Step {
  return {
    id: crypto.randomUUID(),
    type,
    config: {},
  }
}

export default function WorkflowEditorPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const workflowId = params.id

  const [workflow, setWorkflow] = useState<WorkflowData | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [triggerType, setTriggerType] = useState("manual")
  const [steps, setSteps] = useState<Step[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    async function loadWorkflow() {
      try {
        setLoading(true)
        setError("")

        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          throw new Error("Your session has expired. Please sign in again.")
        }

        const { data, error: workflowError } = await supabase
          .from("workflows")
          .select(
            "id, name, description, status, configuration, created_at, updated_at",
          )
          .eq("id", workflowId)
          .single()

        if (workflowError) {
          throw new Error(workflowError.message)
        }

        const loaded = data as WorkflowData
        const configuration = loaded.configuration ?? {}

        setWorkflow(loaded)
        setName(loaded.name ?? "")
        setDescription(loaded.description ?? "")
        setTriggerType(configuration.trigger?.type ?? "manual")
        setSteps(
          Array.isArray(configuration.steps)
            ? configuration.steps
            : [],
        )
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load workflow.",
        )
      } finally {
        setLoading(false)
      }
    }

    if (workflowId) {
      loadWorkflow()
    }
  }, [workflowId])

  async function saveWorkflow(nextStatus?: string) {
    if (!workflow) return

    const trimmedName = name.trim()

    if (!trimmedName) {
      setError("Workflow name is required.")
      return false
    }

    setSaving(true)
    setError("")
    setSuccess("")

    try {
      const configuration: WorkflowConfiguration = {
        trigger: {
          type: triggerType,
          config: {},
        },
        steps,
      }

      const updatePayload: Record<string, unknown> = {
        name: trimmedName,
        description: description.trim(),
        configuration,
        updated_at: new Date().toISOString(),
      }

      if (nextStatus) {
        updatePayload.status = nextStatus
      }

      const { data, error: updateError } = await supabase
        .from("workflows")
        .update(updatePayload)
        .eq("id", workflow.id)
        .select(
          "id, name, description, status, configuration, created_at, updated_at",
        )
        .single()

      if (updateError) {
        throw new Error(updateError.message)
      }

      setWorkflow(data as WorkflowData)
      setSuccess(
        nextStatus
          ? `Workflow ${nextStatus.toLowerCase()}.`
          : "Workflow saved successfully.",
      )

      return true
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save workflow.",
      )
      return false
    } finally {
      setSaving(false)
    }
  }

  async function runWorkflow() {
    if (!workflow) return

    setRunning(true)
    setError("")
    setSuccess("")

    try {
      const response = await fetch("/api/automations/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workflowId: workflow.id,
          input: {
            source: "workflow_editor",
          },
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ?? "Workflow execution failed.",
        )
      }

      setSuccess(
        `Test run completed. Execution ID: ${result.executionId}`,
      )
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to run workflow.",
      )
    } finally {
      setRunning(false)
    }
  }

  function addStep() {
    setSteps((current) => [...current, makeStep()])
  }

  function removeStep(id: string) {
    setSteps((current) => current.filter((step) => step.id !== id))
  }

  function updateStepType(id: string, type: string) {
    setSteps((current) =>
      current.map((step) =>
        step.id === id
          ? {
              ...step,
              type,
              config: {},
            }
          : step,
      ),
    )
  }

  function updateStepConfig(
    id: string,
    key: string,
    value: string,
  ) {
    setSteps((current) =>
      current.map((step) =>
        step.id === id
          ? {
              ...step,
              config: {
                ...step.config,
                [key]: value,
              },
            }
          : step,
      ),
    )
  }

  function getConfigField(step: Step): {
    key: string
    label: string
    placeholder: string
  } | null {
    switch (step.type) {
      case "create_record":
      case "update_record":
        return {
          key: "record",
          label: "Record JSON",
          placeholder: '{"type":"customer","name":"Example"}',
        }

      case "create_task":
        return {
          key: "task",
          label: "Task JSON",
          placeholder: '{"title":"Follow up with customer"}',
        }

      case "send_notification":
        return {
          key: "notification",
          label: "Notification JSON",
          placeholder: '{"title":"New lead","message":"Follow up"}',
        }

      case "run_ai_analysis":
      case "generate_ai_content":
        return {
          key: "prompt",
          label: "AI Prompt",
          placeholder: "Describe what the AI should do...",
        }

      case "call_webhook":
        return {
          key: "url",
          label: "Webhook URL",
          placeholder: "https://example.com/webhook",
        }

      case "update_workflow_status":
        return {
          key: "status",
          label: "New Status",
          placeholder: "active",
        }

      default:
        return null
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background p-5 lg:p-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-3 py-12 text-muted-foreground">
            <Loader2 size={20} className="animate-spin" />
            Loading workflow...
          </div>
        </div>
      </main>
    )
  }

  if (!workflow) {
    return (
      <main className="min-h-screen bg-background p-5 lg:p-8">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/workflows"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} />
            Back to Workflows
          </Link>

          <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/5 p-6">
            <p className="text-sm text-destructive">
              {error || "Workflow not found."}
            </p>
          </div>
        </div>
      </main>
    )
  }

  const isActive = workflow.status?.toLowerCase() === "active"

  return (
    <main className="min-h-screen bg-background p-5 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/workflows"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} />
            Back to Workflows
          </Link>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => saveWorkflow()}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Save
            </button>

            <button
              type="button"
              onClick={runWorkflow}
              disabled={running || saving || !isActive}
              className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              {running ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Play size={16} />
              )}
              Test Run
            </button>

            <button
              type="button"
              onClick={() =>
                saveWorkflow(isActive ? "draft" : "active")
              }
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              {isActive ? "Deactivate" : "Activate"}
            </button>
          </div>
        </div>

        <PageHeader
          eyebrow="AI & Automation"
          title={name || "Workflow Editor"}
          subtitle="Build and manage this workflow using the TechUnified Automation Engine."
        />

        {error ? (
          <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : null}

        {success ? (
          <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm text-primary">{success}</p>
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <Card>
              <div className="flex items-start gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Workflow size={22} />
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">Workflow details</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Define the name and purpose of this automation.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-5">
                <div>
                  <label
                    htmlFor="workflow-name"
                    className="mb-2 block text-sm font-medium"
                  >
                    Name
                  </label>
                  <input
                    id="workflow-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label
                    htmlFor="workflow-description"
                    className="mb-2 block text-sm font-medium"
                  >
                    Description
                  </label>
                  <textarea
                    id="workflow-description"
                    value={description}
                    onChange={(event) =>
                      setDescription(event.target.value)
                    }
                    rows={4}
                    className="w-full resize-none rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold">Trigger</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Choose what starts this workflow.
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <label
                  htmlFor="trigger"
                  className="mb-2 block text-sm font-medium"
                >
                  Trigger type
                </label>

                <div className="relative">
                  <select
                    id="trigger"
                    value={triggerType}
                    onChange={(event) =>
                      setTriggerType(event.target.value)
                    }
                    className="w-full appearance-none rounded-lg border bg-background px-3 py-2.5 pr-10 text-sm outline-none focus:border-primary"
                  >
                    {TRIGGERS.map((trigger) => (
                      <option
                        key={trigger.value}
                        value={trigger.value}
                      >
                        {trigger.label} — {trigger.description}
                      </option>
                    ))}
                  </select>

                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold">Actions</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add the steps TechUnified should execute.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addStep}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  <Plus size={16}
