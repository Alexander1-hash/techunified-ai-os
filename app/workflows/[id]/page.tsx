"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Check,
  Play,
  Plus,
  Save,
  Trash2,
  Zap,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"

type Step = {
  id: string
  type: string
  config: Record<string, unknown>
}

type Workflow = {
  id: string
  name: string
  description: string | null
  status: string
  configuration: {
    trigger?: {
      type?: string
      config?: Record<string, unknown>
    }
    conditions?: unknown[]
    steps?: Step[]
  } | null
}

const STEP_TYPES = [
  { value: "pass_through", label: "Pass Through" },
  { value: "create_record", label: "Create Record" },
  { value: "update_record", label: "Update Record" },
  { value: "create_task", label: "Create Task" },
  { value: "send_notification", label: "Send Notification" },
  { value: "run_ai_analysis", label: "Run AI Analysis" },
  { value: "generate_ai_content", label: "Generate AI Content" },
  { value: "call_webhook", label: "Call Webhook" },
  { value: "update_workflow_status", label: "Update Workflow Status" },
]

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 placeholder:text-slate-400 shadow-sm outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-200"

const largeInputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 shadow-sm outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-200"

const codeInputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-xs text-slate-950 placeholder:text-slate-400 shadow-sm outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-200"

const labelClass =
  "mb-2 block text-sm font-semibold text-slate-800"

const smallLabelClass =
  "mb-2 block text-xs font-semibold text-slate-800"

function getConfigValue(
  config: Record<string, unknown>,
  key: string
): string {
  const value = config[key]

  if (typeof value === "string") {
    return value
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  return ""
}

function parseJsonObject(value: string): Record<string, unknown> {
  if (!value.trim()) {
    return {}
  }

  try {
    const parsed: unknown = JSON.parse(value)

    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>
    }

    return {}
  } catch {
    return {}
  }
}

function configToJson(
  config: Record<string, unknown>,
  key: string
): string {
  const value = config[key]

  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return JSON.stringify(value, null, 2)
  }

  return ""
}

export default function WorkflowEditorPage() {
  const params = useParams()
  const router = useRouter()
  const workflowId = params.id as string

  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [triggerType, setTriggerType] = useState("manual")
  const [triggerConfig, setTriggerConfig] = useState<
    Record<string, unknown>
  >({})
  const [steps, setSteps] = useState<Step[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState("")

  const supabase = createClient()

  useEffect(() => {
    if (workflowId) {
      void loadWorkflow()
    }
  }, [workflowId])

  async function loadWorkflow() {
    setLoading(true)
    setMessage("")

    const { data, error } = await supabase
      .from("workflows")
      .select("id,name,description,status,configuration")
      .eq("id", workflowId)
      .single()

    if (error || !data) {
      setMessage(error?.message || "Unable to load this workflow.")
      setLoading(false)
      return
    }

    const loaded = data as Workflow

    setWorkflow(loaded)
    setName(loaded.name || "")
    setDescription(loaded.description || "")
    setTriggerType(
      loaded.configuration?.trigger?.type || "manual"
    )
    setTriggerConfig(
      loaded.configuration?.trigger?.config || {}
    )
    setSteps(loaded.configuration?.steps || [])
    setLoading(false)
  }

  function addStep() {
    const newStep: Step = {
      id: crypto.randomUUID(),
      type: "pass_through",
      config: {},
    }

    setSteps((current) => [...current, newStep])
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
          : step
      )
    )
  }

  function updateStepConfig(
    id: string,
    key: string,
    value: unknown
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
          : step
      )
    )
  }

  function removeStep(id: string) {
    setSteps((current) =>
      current.filter((step) => step.id !== id)
    )
  }

  function updateTriggerConfig(key: string, value: unknown) {
    setTriggerConfig((current) => ({
      ...current,
      [key]: value,
    }))
  }

  async function saveWorkflow() {
    setSaving(true)
    setMessage("")

    const configuration = {
      trigger: {
        type: triggerType,
        config: triggerConfig,
      },
      conditions: [],
      steps,
    }

    const { error } = await supabase
      .from("workflows")
      .update({
        name,
        description,
        configuration,
        updated_at: new Date().toISOString(),
      })
      .eq("id", workflowId)

    if (error) {
      setMessage(error.message)
      setSaving(false)
      return
    }

    setWorkflow((current) =>
      current
        ? {
            ...current,
            name,
            description,
            configuration,
          }
        : current
    )

    setMessage("Workflow saved.")
    setSaving(false)
  }

  async function updateStatus(status: string) {
    setSaving(true)
    setMessage("")

    const { error } = await supabase
      .from("workflows")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", workflowId)

    if (error) {
      setMessage(error.message)
      setSaving(false)
      return
    }

    setWorkflow((current) =>
      current
        ? {
            ...current,
            status,
          }
        : current
    )

    setMessage(
      status === "active"
        ? "Workflow activated."
        : "Workflow saved as draft."
    )

    setSaving(false)
  }

  async function runWorkflow() {
    setRunning(true)
    setMessage("")

    try {
      const response = await fetch("/api/automations/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workflowId,
          input: {},
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setMessage(
          result.error || "Workflow execution failed."
        )
        setRunning(false)
        return
      }

      if (result.executionId) {
        router.push(
          `/automations/executions/${result.executionId}`
        )
        return
      }

      setMessage("Workflow executed successfully.")
    } catch {
      setMessage("Unable to execute workflow.")
    }

    setRunning(false)
  }

  function renderStepConfig(step: Step) {
    switch (step.type) {
      case "create_record":
        return (
          <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4">
            <div>
              <label className={smallLabelClass}>
                Supabase Table
              </label>

              <input
                value={getConfigValue(step.config, "table")}
                onChange={(event) =>
                  updateStepConfig(
                    step.id,
                    "table",
                    event.target.value
                  )
                }
                placeholder="e.g. customers"
                className={inputClass}
              />
            </div>

            <div>
              <label className={smallLabelClass}>
                Record JSON
              </label>

              <textarea
                rows={7}
                value={configToJson(step.config, "record")}
                onChange={(event) =>
                  updateStepConfig(
                    step.id,
                    "record",
                    parseJsonObject(event.target.value)
                  )
                }
                placeholder={`{
  "name": "Example",
  "status": "new"
}`}
                className={codeInputClass}
              />
            </div>
          </div>
        )

      case "update_record":
        return (
          <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4">
            <div>
              <label className={smallLabelClass}>
                Supabase Table
              </label>

              <input
                value={getConfigValue(step.config, "table")}
                onChange={(event) =>
                  updateStepConfig(
                    step.id,
                    "table",
                    event.target.value
                  )
                }
                placeholder="e.g. customers"
                className={inputClass}
              />
            </div>

            <div>
              <label className={smallLabelClass}>
                Record ID
              </label>

              <input
                value={getConfigValue(step.config, "id")}
                onChange={(event) =>
                  updateStepConfig(
                    step.id,
                    "id",
                    event.target.value
                  )
                }
                placeholder="UUID of the record"
                className={inputClass}
              />
            </div>

            <div>
              <label className={smallLabelClass}>
                Updated Record JSON
              </label>

              <textarea
                rows={7}
                value={configToJson(step.config, "record")}
                onChange={(event) =>
                  updateStepConfig(
                    step.id,
                    "record",
                    parseJsonObject(event.target.value)
                  )
                }
                placeholder={`{
  "status": "completed"
}`}
                className={codeInputClass}
              />
            </div>
          </div>
        )

      case "create_task":
        return (
          <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4">
            <div>
              <label className={smallLabelClass}>
                Task Title
              </label>

              <input
                value={getConfigValue(step.config, "title")}
                onChange={(event) =>
                  updateStepConfig(
                    step.id,
                    "title",
                    event.target.value
                  )
                }
                placeholder="Follow up with customer"
                className={inputClass}
              />
            </div>

            <div>
              <label className={smallLabelClass}>
                Description
              </label>

              <textarea
                rows={4}
                value={getConfigValue(
                  step.config,
                  "description"
                )}
                onChange={(event) =>
                  updateStepConfig(
                    step.id,
                    "description",
                    event.target.value
                  )
                }
                placeholder="Describe what needs to be done."
                className={inputClass}
              />
            </div>

            <div>
              <label className={smallLabelClass}>
                Priority
              </label>

              <select
                value={
                  getConfigValue(
                    step.config,
                    "priority"
                  ) || "medium"
                }
                onChange={(event) =>
                  updateStepConfig(
                    step.id,
                    "priority",
                    event.target.value
                  )
                }
                className={inputClass}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <p className="text-xs font-medium text-amber-700">
              Task creation will be connected to the native
              TechUnified task system.
            </p>
          </div>
        )

      case "send_notification":
        return (
          <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4">
            <div>
              <label className={smallLabelClass}>
                Recipient
              </label>

              <input
                value={getConfigValue(
                  step.config,
                  "recipient"
                )}
                onChange={(event) =>
                  updateStepConfig(
                    step.id,
                    "recipient",
                    event.target.value
                  )
                }
                placeholder="Email, user ID, or notification target"
                className={inputClass}
              />
            </div>

            <div>
              <label className={smallLabelClass}>
                Title
              </label>

              <input
                value={getConfigValue(step.config, "title")}
                onChange={(event) =>
                  updateStepConfig(
                    step.id,
                    "title",
                    event.target.value
                  )
                }
                placeholder="Automation notification"
                className={inputClass}
              />
            </div>

            <div>
              <label className={smallLabelClass}>
                Message
              </label>

              <textarea
                rows={4}
                value={getConfigValue(
                  step.config,
                  "message"
                )}
                onChange={(event) =>
                  updateStepConfig(
                    step.id,
                    "message",
                    event.target.value
                  )
                }
                placeholder="Your workflow has completed."
                className={inputClass}
              />
            </div>

            <p className="text-xs font-medium text-amber-700">
              Notification delivery will use the connected
              TechUnified notification providers.
            </p>
          </div>
        )

      case "run_ai_analysis":
        return (
          <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4">
            <div>
              <label className={smallLabelClass}>
                Analysis Prompt
              </label>

              <textarea
                rows={6}
                value={getConfigValue(step.config, "prompt")}
                onChange={(event) =>
                  updateStepConfig(
                    step.id,
                    "prompt",
                    event.target.value
                  )
                }
                placeholder="Analyze the workflow input and identify important insights, risks, and recommended actions."
                className={inputClass}
              />
            </div>

            <div>
              <label className={smallLabelClass}>
                Model
              </label>

              <input
                value={getConfigValue(step.config, "model")}
                onChange={(event) =>
                  updateStepConfig(
                    step.id,
                    "model",
                    event.target.value
                  )
                }
                placeholder="gpt-5.6-luna"
                className={inputClass}
              />
            </div>

            <p className="text-xs font-medium text-slate-600">
              The native TechUnified AI service will receive
              the workflow input together with this prompt.
            </p>
          </div>
        )

      case "generate_ai_content":
        return (
          <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4">
            <div>
              <label className={smallLabelClass}>
                Content Prompt
              </label>

              <textarea
                rows={6}
                value={getConfigValue(step.config, "prompt")}
                onChange={(event) =>
                  updateStepConfig(
                    step.id,
                    "prompt",
                    event.target.value
                  )
                }
                placeholder="Create a professional customer follow-up message using the workflow input."
                className={inputClass}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={smallLabelClass}>
                  Model
                </label>

                <input
                  value={getConfigValue(
                    step.config,
                    "model"
                  )}
                  onChange={(event) =>
                    updateStepConfig(
                      step.id,
                      "model",
                      event.target.value
                    )
                  }
                  placeholder="gpt-5.6-luna"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={smallLabelClass}>
                  Output Format
                </label>

                <select
                  value={
                    getConfigValue(
                      step.config,
                      "outputFormat"
                    ) || "text"
                  }
                  onChange={(event) =>
                    updateStepConfig(
                      step.id,
                      "outputFormat",
                      event.target.value
                    )
                  }
                  className={inputClass}
                >
                  <option value="text">Text</option>
                  <option value="email">Email</option>
                  <option value="social_post">
                    Social Post
                  </option>
                  <option value="summary">Summary</option>
                  <option value="json">JSON</option>
                </select>
              </div>
            </div>
          </div>
        )

      case "call_webhook":
        return (
          <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4">
            <div>
              <label className={smallLabelClass}>
                Webhook URL
              </label>

              <input
                value={getConfigValue(step.config, "url")}
                onChange={(event) =>
                  updateStepConfig(
                    step.id,
                    "url",
                    event.target.value
                  )
                }
                placeholder="https://example.com/webhook"
                className={inputClass}
              />
            </div>

            <div>
              <label className={smallLabelClass}>
                HTTP Method
              </label>

              <select
                value={
                  getConfigValue(step.config, "method") ||
                  "POST"
                }
                onChange={(event) =>
                  updateStepConfig(
                    step.id,
                    "method",
                    event.target.value
                  )
                }
                className={inputClass}
              >
                <option value="POST">POST</option>
                <option value="GET">GET</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>

            <div>
              <label className={smallLabelClass}>
                Headers JSON
              </label>

              <textarea
                rows={5}
                value={configToJson(step.config, "headers")}
                onChange={(event) =>
                  updateStepConfig(
                    step.id,
                    "headers",
                    parseJsonObject(event.target.value)
                  )
                }
                placeholder={`{
  "Authorization": "Bearer YOUR_TOKEN"
}`}
                className={codeInputClass}
              />
            </div>
          </div>
        )

      case "update_workflow_status":
        return (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <label className={smallLabelClass}>
              New Workflow Status
            </label>

            <select
              value={
                getConfigValue(
                  step.config,
                  "status"
                ) || "active"
              }
              onChange={(event) =>
                updateStepConfig(
                  step.id,
                  "status",
                  event.target.value
                )
              }
              className={inputClass}
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
          </div>
        )

      case "pass_through":
      default:
        return (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-medium text-slate-700">
                Pass Through
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-600">
                This step passes the current workflow data
                through without changing it.
              </p>
            </div>
          </div>
        )
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm font-medium text-slate-700">
              Loading workflow...
            </p>
          </div>
        </div>
      </main>
    )
  }

  if (!workflow) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/workflows"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Workflows
          </Link>

          <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
            <h1 className="text-lg font-semibold text-slate-950">
              Workflow unavailable
            </h1>

            <p className="mt-2 text-sm font-medium text-red-600">
              {message ||
                "This workflow could not be loaded."}
            </p>
          </div>
        </div>
      </main>
    )
  }

  const isActive = workflow.status === "active"

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/workflows"
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-950"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Workflows
            </Link>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm">
                <Zap className="h-5 w-5" />
              </div>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                  Workflow Editor
                </h1>

                <p className="text-sm font-medium text-slate-600">
                  TechUnified Automation Engine
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runWorkflow}
              disabled={running || saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              {running ? "Running..." : "Test Run"}
            </button>

            <button
              type="button"
              onClick={saveWorkflow}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save"}
            </button>

            <button
              type="button"
              onClick={() =>
                void updateStatus(
                  isActive ? "draft" : "active"
                )
              }
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {isActive ? "Deactivate" : "Activate"}
            </button>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm">
            {message}
          </div>
        )}

        <div className="grid gap-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-950">
                  Workflow Details
                </h2>

                <p className="mt-1 text-sm font-medium text-slate-600">
                  Define what this automation does.
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  isActive
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {workflow.status}
              </span>
            </div>

            <div className="grid gap-5">
              <div>
                <label className={labelClass}>
                  Name
                </label>

                <input
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="Customer follow-up automation"
                  className={largeInputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Description
                </label>

                <textarea
                  rows={4}
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  placeholder="Describe what this workflow should accomplish."
                  className={largeInputClass}
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5">
              <h2 className="font-semibold text-slate-950">
                Trigger
              </h2>

              <p className="mt-1 text-sm font-medium text-slate-600">
                Choose how this workflow starts.
              </p>
            </div>

            <div className="grid gap-5">
              <div>
                <label className={labelClass}>
                  Trigger Type
                </label>

                <select
                  value={triggerType}
                  onChange={(event) => {
                    setTriggerType(event.target.value)
                    setTriggerConfig({})
                  }}
                  className={largeInputClass}
                >
                  <option value="manual">Manual</option>
                  <option value="webhook_received">
                    Webhook
                  </option>
                  <option value="schedule">
                    Schedule
                  </option>
                  <option value="event">
                    Event
                  </option>
                </select>
              </div>

              {triggerType === "webhook_received" && (
                <div>
                  <label className={labelClass}>
                    Webhook Secret
                  </label>

                  <input
                    type="password"
                    value={getConfigValue(
                      triggerConfig,
                      "secret"
                    )}
                    onChange={(event) =>
                      updateTriggerConfig(
                        "secret",
                        event.target.value
                      )
                    }
                    placeholder="Create a secret for this webhook"
                    className={largeInputClass}
                  />

                  <p className="mt-2 text-xs font-medium text-slate-600">
                    This secret will be used to secure the native
                    TechUnified webhook endpoint.
                  </p>
                </div>
              )}

              {triggerType === "schedule" && (
                <div>
                  <label className={labelClass}>
                    Cron Schedule
                  </label>

                  <input
                    value={getConfigValue(
                      triggerConfig,
                      "cron"
                    )}
                    onChange={(event) =>
                      updateTriggerConfig(
                        "cron",
                        event.target.value
                      )
                    }
                    placeholder="0 9 * * *"
                    className={largeInputClass}
                  />

                  <p className="mt-2 text-xs font-medium text-slate-600">
                    Example: 0 9 * * * runs daily at 9:00.
                  </p>
                </div>
              )}

              {triggerType === "event" && (
                <div>
                  <label className={labelClass}>
                    Event Name
                  </label>

                  <input
                    value={getConfigValue(
                      triggerConfig,
                      "event"
                    )}
                    onChange={(event) =>
                      updateTriggerConfig(
                        "event",
                        event.target.value
                      )
                    }
                    placeholder="customer.created"
                    className={largeInputClass}
                  />
                </div>
              )}

              {triggerType === "manual" && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium leading-6 text-slate-700">
                    This workflow can be started manually from
                    the Automations page or with Test Run.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-slate-950">
                  Actions
                </h2>

                <p className="mt-1 text-sm font-medium text-slate-600">
                  Add the operations the automation should perform.
                </p>
              </div>

              <button
                type="button"
                onClick={addStep}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" />
                Add Action
              </button>
            </div>

            {steps.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <Zap className="mx-auto h-7 w-7 text-slate-500" />

                <p className="mt-3 text-sm font-semibold text-slate-800">
                  No actions yet
                </p>

                <p className="mt-1 text-sm font-medium text-slate-600">
                  Add an action to define what this workflow
                  should do.
                </p>

                <button
                  type="button"
                  onClick={addStep}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                >
                  <Plus className="h-4 w-4" />
                  Add First Action
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {steps.map((step, index) => (
                  <div
                    key={step.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-800">
                        {index + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          <select
                            value={step.type}
                            onChange={(event) =>
                              updateStepType(
                                step.id,
                                event.target.value
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-950 shadow-sm outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-200 sm:max-w-md"
                          >
                            {STEP_TYPES.map((type) => (
                              <option
                                key={type.value}
                                value={type.value}
                              >
                                {type.label}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() =>
                              removeStep(step.id)
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 sm:ml-auto"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </button>
                        </div>

                        {renderStepConfig(step)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-slate-950">
                  Automation Engine
                </h2>

                <p className="mt-1 text-sm font-medium text-slate-600">
                  This workflow runs through the native TechUnified
                  Automation Engine.
                </p>
              </div>

              <Link
                href="/automations"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
              >
                View Automations
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
