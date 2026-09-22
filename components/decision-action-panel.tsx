'use client'

import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  Loader2,
  Play,
  Workflow,
  XCircle,
} from 'lucide-react'

type WorkflowRecord = {
  id: string
  name: string
  description?: string | null
  status: string
  created_at?: string
  updated_at?: string
}

type WorkflowsResponse = {
  success?: boolean
  workflows?: WorkflowRecord[]
  error?: string
}

type ActionResult = {
  success?: boolean
  executionId?: string | null
  error?: string
  workflow?: {
    id: string
    name: string
    status: string
  }
}

type DecisionActionPanelProps = {
  decisionId: string
  defaultActionType?:
    | 'run_workflow'
    | 'analyze_with_ai'
    | 'generate_content'
  input?: Record<string, unknown>
}

export function DecisionActionPanel({
  decisionId,
  defaultActionType = 'run_workflow',
  input,
}: DecisionActionPanelProps) {
  const [workflows, setWorkflows] = useState<
    WorkflowRecord[]
  >([])

  const [selectedWorkflowId, setSelectedWorkflowId] =
    useState('')

  const [actionType, setActionType] = useState(
    defaultActionType,
  )

  const [loadingWorkflows, setLoadingWorkflows] =
    useState(true)

  const [executing, setExecuting] =
    useState(false)

  const [message, setMessage] =
    useState('')

  const [error, setError] =
    useState('')

  useEffect(() => {
    let cancelled = false

    async function loadWorkflows() {
      try {
        setLoadingWorkflows(true)
        setError('')

        const response = await fetch(
          '/api/workflows',
          {
            method: 'GET',
            cache: 'no-store',
          },
        )

        const json =
          (await response.json()) as WorkflowsResponse

        if (!response.ok || !json.success) {
          throw new Error(
            json.error ??
              'Unable to load workflows.',
          )
        }

        const activeWorkflows =
          (json.workflows ?? []).filter(
            (workflow) =>
              String(
                workflow.status,
              ).toLowerCase() === 'active',
          )

        if (!cancelled) {
          setWorkflows(activeWorkflows)

          if (activeWorkflows.length > 0) {
            setSelectedWorkflowId(
              activeWorkflows[0].id,
            )
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load workflows.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoadingWorkflows(false)
        }
      }
    }

    loadWorkflows()

    return () => {
      cancelled = true
    }
  }, [])

  async function executeAction() {
    if (!selectedWorkflowId) {
      setError(
        'Select an active workflow first.',
      )
      return
    }

    if (!decisionId) {
      setError(
        'A decision ID is required.',
      )
      return
    }

    try {
      setExecuting(true)
      setError('')
      setMessage('')

      const response = await fetch(
        '/api/business/decisions/actions',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            decisionId,
            actionType,
            workflowId:
              selectedWorkflowId,
            input: input ?? {},
          }),
        },
      )

      const json =
        (await response.json()) as ActionResult

      if (!response.ok || !json.success) {
        throw new Error(
          json.error ??
            'Decision action failed.',
        )
      }

      setMessage(
        json.executionId
          ? `Action executed successfully. Execution ID: ${json.executionId}`
          : 'Action executed successfully.',
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Decision action failed.',
      )
    } finally {
      setExecuting(false)
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 text-primary">
          <Workflow size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">
            Take action
          </p>

          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Connect this decision to an active
            workflow and execute it explicitly.
          </p>

          {loadingWorkflows ? (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2
                size={14}
                className="animate-spin"
              />
              Loading active workflows…
            </div>
          ) : workflows.length === 0 ? (
            <div className="mt-3 rounded-lg border border-border/60 bg-background p-3">
              <p className="text-xs font-medium text-foreground">
                No active workflows available.
              </p>

              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Create and activate a workflow
                before executing this decision.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-foreground">
                    Action
                  </span>

                  <div className="relative">
                    <select
                      value={actionType}
                      onChange={(event) =>
                        setActionType(
                          event.target
                            .value as
                            | 'run_workflow'
                            | 'analyze_with_ai'
                            | 'generate_content',
                        )
                      }
                      className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2.5 pr-9 text-sm outline-none focus:border-primary"
                    >
                      <option value="run_workflow">
                        Run workflow
                      </option>

                      <option value="analyze_with_ai">
                        Analyze with AI
                      </option>

                      <option value="generate_content">
                        Generate AI content
                      </option>
                    </select>

                    <ChevronDown
                      size={15}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-foreground">
                    Workflow
                  </span>

                  <div className="relative">
                    <select
                      value={
                        selectedWorkflowId
                      }
                      onChange={(event) =>
                        setSelectedWorkflowId(
                          event.target.value,
                        )
                      }
                      className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2.5 pr-9 text-sm outline-none focus:border-primary"
                    >
                      {workflows.map(
                        (workflow) => (
                          <option
                            key={
                              workflow.id
                            }
                            value={
                              workflow.id
                            }
                          >
                            {workflow.name}
                          </option>
                        ),
                      )}
                    </select>

                    <ChevronDown
                      size={15}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                  </div>
                </label>
              </div>

              <button
                type="button"
                onClick={executeAction}
                disabled={executing}
                className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {executing ? (
                  <>
                    <Loader2
                      size={15}
                      className="animate-spin"
                    />
                    Executing…
                  </>
                ) : (
                  <>
                    <Play size={15} />
                    Execute action
                  </>
                )}
              </button>
            </>
          )}

          {message ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-border/60 bg-background p-3">
              <CheckCircle2
                size={15}
                className="mt-0.5 shrink-0"
              />

              <p className="text-xs leading-5 text-foreground">
                {message}
              </p>
            </div>
          ) : null}

          {error ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-border/60 bg-background p-3">
              <XCircle
                size={15}
                className="mt-0.5 shrink-0"
              />

              <p className="text-xs leading-5 text-foreground">
                {error}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
