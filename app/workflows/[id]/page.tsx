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
    const parsed = JSON.parse(value)

    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      return parsed
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
      const response = await fetch(
        "/api/automations/execute",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            workflowId,
            input: {},
          }),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        setMessage(
          result.error || "Workflow execution failed."
        )
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

  function renderStepConfig(step: Step) {
    switch (step.type) {
      case "create_record":
        return (
          <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4">
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-600">
                Supabase Table
              </label>

              <input
                value={getConfigValue(
                  step.config,
                  "table"
                )}
                onChange={(event) =>
                  updateStepConfig(
                    step.id,
                    "table",
                    event.target.value
                  )
                }
                placeholder="e.g. customers"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-slate-600">
                Record JSON
              </label>

              <textarea
                rows={7}
                value={configToJson(
                  step.config,
                  "record"
                )}
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-xs outline-none focus:border-slate-500"
              />
            </div>
          </div>
        )

      case "update_record":
        return (
          <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4">
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-600">
                Supabase Table
              </label>

              <input
                value={getConfigValue(
                  step.config,
                  "table"
                )}
                onChange={(event) =>
                  updateStepConfig(
                    step.id,
                    "table",
                    event.target.value
                  )
                }
                placeholder="e.g. customers"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-slate-600">
                Record ID
              </label>

              <input
                value={getConfigValue(
                  step.config,
                  "id"
                )}
                onChange={(event) =>
                  updateStepConfig(
                    step.id,
                    "id",
                    event.target.value
                  )
                }
                placeholder="UUID of the record"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-slate-600">
                Updated Record JSON
              </label>

              <textarea
                rows={7}
                value={configToJson(
                  step.config,
                  "record"
                )}
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-xs outline-none focus:border-slate-500"
              />
            </div>
          </div>
        )

      case "create_task":
        return (
          <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4">
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-600">
                Task Title
              </label>

              <input
                value={getConfigValue(
                  step.config,
                  "title"
                )}
                onChange={(event) =>
                  updateStepConfig(
                    step.id,
                    "title",
                    event.target.value
                  )
                }
                placeholder="Follow up with customer"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-slate-600">
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-slate-600">
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
        )

      case "send_notification":
        return (
          <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4">
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-600">
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-slate-600">
                Title
              </label>

              <input
                value={getConfigValue(
                  step.config,
                  "title"
                )}
                onChange={(event) =>
                  updateStepConfig(
                    step.id,
                    "title",
                    event.target.value
                  )
                }
                placeholder="Automation notification"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-slate-600">
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
            </div>
          </div>
        )

      case "run_ai_analysis":
        return (
          <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4">
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-600">
                Analysis Prompt
              </label>

              <textarea
                rows={6}
                value={getConfigValue(
                  step.config,
                  "prompt"
                )}
                onChange={(event) =>
                  updateStepConfig(
                    step.id,
                    "prompt",
                    event.target.value
                  )
                }
                placeholder="Analyze the incoming business data and identify important issues."
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-slate-600">
                Model
              </label>

              <input
                value={
                  getConfigValue(
                    step.config,
                    "model"
                  ) || "gpt-5.6-luna"
                }
                onChange={(event) =>
                  updateStepConfig(
                    step.id,
                    "model",
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
            </div>
          </div>
        )

      case "generate_ai_content":
        return (
          <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4">
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-600">
                Content Prompt
              </label>

              <textarea
                rows={6}
                value={getConfigValue(
                  step.config,
                  "prompt"
                )}
                onChange={(event) =>
                  updateStepConfig(
                    step.id,
                    "prompt",
                    event.target.value
                  )
                }
                placeholder="Create a professional customer follow-up message."
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-slate-600">
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              >
                <option value="text">Text</option>
                <option value="json">JSON</option>
                <option value="email">Email</option>
                <option value="social">Social Post</option>
              </select>
            </div>
          </div>
        )

      case "call_webhook":
        return (
          <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4">
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-600">
                Webhook URL
              </label>

              <input
                value={getConfigValue(
                  step.config,
                  "url"
                )}
                onChange={(event) =>
                  updateStepConfig(
                    step.id,
                    "url",
                    event.target.value
                  )
                }
                                placeholder="https://example.com/webhook"
              />

              <select
                value={getConfigValue(
                  step.config,
                  "method",
                  "POST"
                )}
                onChange={(event) =>
                  updateStepConfig(
                    step.id,
                    "method",
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="POST">POST</option>
                <option value="GET">GET</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
              </select>
