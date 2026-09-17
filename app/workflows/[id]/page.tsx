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
  description: string
  status: string
  configuration: {
    trigger?: {
      type?: string
      config?: Record<string, unknown>
    }
    conditions?: unknown[]
    steps?: Step[]
  }
}

const STEP_TYPES = [
  {
    value: "pass_through",
    label: "Pass Through",
  },
  {
    value: "create_record",
    label: "Create Record",
  },
  {
    value: "update_record",
    label: "Update Record",
  },
  {
    value: "create_task",
    label: "Create Task",
  },
  {
    value: "send_notification",
    label: "Send Notification",
  },
  {
    value: "run_ai_analysis",
    label: "Run AI Analysis",
  },
  {
    value: "generate_ai_content",
    label: "Generate AI Content",
  },
  {
    value: "call_webhook",
    label: "Call Webhook",
  },
  {
    value: "update_workflow_status",
    label: "Update Workflow Status",
  },
]

export default function WorkflowEditorPage() {
  const params = useParams()
  const router = useRouter()
  const workflowId = params.id as string

  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [triggerType, setTriggerType] = useState("manual")
  const [steps, setSteps] = useState<Step[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState("")

  const supabase = createClient()

  useEffect(() => {
    loadWorkflow()
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
      setMessage("Unable to load this workflow.")
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

  async function saveWorkflow() {
    setSaving(true)
    setMessage("")

    const configuration = {
      trigger: {
        type: triggerType,
        config: {},
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
      status.toLowerCase() === "active"
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
        setMessage(result.error || "Workflow execution failed.")
        setRunning(false)
        return
      }

      setMessage("Workflow executed successfully.")

      if (result.executionId) {
        router.push(
          `/automations/executions/${result.executionId}`
        )
      }
    } catch {
      setMessage("Unable to execute workflow.")
    }

    setRunning(false)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-white p-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm text-slate-500">
            Loading workflow...
          </p>
        </div>
      </main>
    )
  }

  if (!workflow) {
    return (
      <main className="min-h-screen bg-white p-6">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/workflows"
            className="inline-flex items-center gap-2 text-sm text-slate-600"
          >
            <ArrowLeft size={16} />
            Back to Workflows
          </Link>

          <div className="mt-8 rounded-xl border border-slate-200 p-6">
            <p className="text-sm text-red-600">
              {message || "Workflow not found."}
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/workflows"
              className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft size={16} />
              Workflows
            </Link>

            <h1 className="text-2xl font-semibold text-slate-950">
              {name || "Workflow"}
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Build and manage an automated business process.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={saveWorkflow}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save"}
            </button>

            <button
              onClick={runWorkflow}
              disabled={running}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <Play size={16} />
              {running ? "Running..." : "Test Run"}
            </button>
          </div>
        </div>

        {message && (
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {message}
          </div>
        )}

        <div className="mt-6 grid gap-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-lg bg-slate-100 p-2">
                <Zap size={18} className="text-slate-700" />
              </div>

              <div>
                <h2 className="font-semibold text-slate-950">
                  Workflow Details
                </h2>

                <p className="text-sm text-slate-500">
                  Configure the basic workflow information.
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Name
                </label>

                <input
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  placeholder="Workflow name"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Description
                </label>

                <textarea
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  placeholder="What should this workflow do?"
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5">
              <h2 className="font-semibold text-slate-950">
                Trigger
              </h2>

              <p className="text-sm text-slate-500">
                Choose how this workflow starts.
              </p>
            </div>

            <select
              value={triggerType}
              onChange={(event) =>
                setTriggerType(event.target.value)
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
            >
              <option value="manual">Manual</option>
              <option value="webhook">Webhook</option>
              <option value="schedule">Schedule</option>
              <option value="event">Event</option>
            </select>

            <p className="mt-3 text-xs text-slate-500">
              The selected trigger is stored in the workflow
              configuration and can be connected to the native
              TechUnified Automation Engine.
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-slate-950">
                  Actions
                </h2>

                <p className="text-sm text-slate-500">
                  Define the actions executed by this workflow.
                </p>
              </div>

              <button
                onClick={addStep}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Plus size={16} />
                Add Action
              </button>
            </div>

            {steps.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 px-5 py-10 text-center">
                <p className="text-sm font-medium text-slate-700">
                  No actions added yet.
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Add an action to define what the workflow should
                  do.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div
                    key={step.id}
                    className="rounded-lg border border-slate-200 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                        {index + 1}
                      </div>

                      <select
                        value={step.type}
                        onChange={(event) =>
                          updateStepType(
                            step.id,
                            event.target.value
                          )
                        }
                        className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
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
                        onClick={() =>
                          removeStep(step.id)
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-slate-950">
                  Workflow Status
                </h2>

                <p className="text-sm text-slate-500">
                  Control whether this workflow can run.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => updateStatus("active")}
                  disabled={saving || workflow.status === "active"}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                >
                  <Check size={16} />
                  Activate
                </button>

                <button
                  onClick={() => updateStatus("draft")}
                  disabled={saving || workflow.status === "draft"}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-40"
                >
                  Set Draft
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Current status:{" "}
              <span className="font-medium text-slate-950">
                {workflow.status}
              </span>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold text-slate-950">
                  TechUnified Automation Engine
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  This workflow runs through the native TechUnified
                  automation engine.
                </p>
              </div>

              <Link
                href="/automations"
                className="shrink-0 text-sm font-medium text-slate-700 hover:text-slate-950"
              >
                Automations
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
      }
