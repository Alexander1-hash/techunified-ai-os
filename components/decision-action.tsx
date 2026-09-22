'use client'

import { useEffect, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Play,
  RefreshCw,
  Workflow,
  X,
} from 'lucide-react'

type DecisionActionProps = {
  decisionId: string
  decisionTitle: string
  decisionAction: string
}

type WorkflowRecord = {
  id: string
  name: string
  description: string | null
  status: string
  created_at: string
  updated_at: string
}

type ActionState =
  | 'idle'
  | 'selecting'
  | 'ready'
  | 'executing'
  | 'success'
  | 'error'

export function DecisionAction({
  decisionId,
  decisionTitle,
  decisionAction,
}: DecisionActionProps) {
  const [state, setState] =
    useState<ActionState>('idle')

  const [workflows, setWorkflows] =
    useState<WorkflowRecord[]>([])

  const [selectedWorkflowId, setSelectedWorkflowId] =
    useState('')

  const [loadingWorkflows, setLoadingWorkflows] =
    useState(false)

  const [message, setMessage] =
    useState('')

  const [executionId, setExecutionId] =
    useState('')

  async function loadActiveWorkflows() {
    try {
      setLoadingWorkflows(true)
      setMessage('')

      const response = await fetch('/api/workflows', {
        method: 'GET',
        cache: 'no-store',
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ?? 'Unable to load workflows.',
        )
      }

      const activeWorkflows = (
        data.workflows ?? []
      ).filter(
        (workflow: WorkflowRecord) =>
          workflow.status.toLowerCase() === 'active',
      )

      setWorkflows(activeWorkflows)

      if (
        activeWorkflows.length > 0 &&
        !selectedWorkflowId
      ) {
        setSelectedWorkflowId(
          activeWorkflows[0].id,
        )
      }
    } catch (error) {
      setWorkflows([])
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load active workflows.',
      )
    } finally {
      setLoadingWorkflows(false)
    }
  }

  function openActionPanel() {
    setMessage('')
    setExecutionId('')
    setSelectedWorkflowId('')
    setState('selecting')

    void loadActiveWorkflows()
  }

  function closeActionPanel() {
    if (state === 'executing') {
      return
    }

    setState('idle')
    setMessage('')
    setExecutionId('')
    setSelectedWorkflowId('')
  }

  function prepareWorkflow() {
    if (!selectedWorkflowId) {
      setMessage(
        'Select an active workflow before continuing.',
      )
      return
    }

    setMessage('')
    setState('ready')
  }

  async function executeAction() {
    if (!selectedWorkflowId) {
      setMessage(
        'Select an active workflow before executing this action.',
      )
      setState('selecting')
      return
    }

    setState('executing')
    setMessage('Executing workflow…')
    setExecutionId('')

    try {
      const response = await fetch(
        '/api/automations/execute',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workflowId: selectedWorkflowId,
            input: {
              source: 'decision_engine',
              decision: {
                id: decisionId,
                title: decisionTitle,
                action: decisionAction,
              },
            },
          }),
        },
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ?? 'Automation execution failed.',
        )
      }

      setExecutionId(
        data.executionId ?? '',
      )

      setMessage(
        'The workflow executed successfully.',
      )

      setState('success')
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to execute the workflow.',
      )

      setState('error')
    }
  }

  useEffect(() => {
    if (state !== 'selecting') {
      return
    }

    if (
      workflows.length > 0 &&
      selectedWorkflowId
    ) {
      return
    }

    void loadActiveWorkflows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const selectedWorkflow =
    workflows.find(
      (workflow) =>
        workflow.id === selectedWorkflowId,
    ) ?? null

  if (state === 'idle') {
    return (
      <button
        type="button"
        onClick={openActionPanel}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <Play size={14} />
        Take Action
        <ArrowRight size={14} />
      </button>
    )
  }

  return (
    <div className="mt-4 rounded-xl border border-border/70 bg-background p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Workflow
              size={16}
              className="text-primary"
            />

            <p className="text-sm font-medium text-foreground">
              Take Action
            </p>
          </div>

          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Turn this decision into an executable
            business workflow.
          </p>
        </div>

        {state !== 'executing' ? (
          <button
            type="button"
            onClick={closeActionPanel}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close action panel"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      <div className="mt-4 rounded-lg border border-border/60 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-primary">
          Decision
        </p>

        <p className="mt-1 text-sm font-medium text-foreground">
          {decisionTitle}
        </p>

        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {decisionAction}
        </p>
      </div>

      <div className="mt-3 rounded-lg border border-border/60 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-primary">
              Workflow
            </p>

            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Only active workflows can execute a
              Decision Engine action.
            </p>
          </div>

          {state === 'selecting' ? (
            <button
              type="button"
              onClick={() => {
                void loadActiveWorkflows()
              }}
              disabled={loadingWorkflows}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Refresh workflows"
            >
              <RefreshCw
                size={15}
                className={
                  loadingWorkflows
                    ? 'animate-spin'
                    : ''
                }
              />
            </button>
          ) : null}
        </div>

        {state === 'selecting' ? (
          <>
            {loadingWorkflows ? (
              <div className="mt-3 rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">
                  Loading active workflows…
                </p>
              </div>
            ) : workflows.length === 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-border/70 p-4">
                <p className="text-xs font-medium text-foreground">
                  No active workflows available
                </p>

                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  Create and activate a workflow in
                  the Automation Engine before using
                  Take Action.
                </p>
              </div>
            ) : (
              <>
                <label className="mt-3 block text-[11px] font-medium text-muted-foreground">
                  Select active workflow
                </label>

                <select
                  value={selectedWorkflowId}
                  onChange={(event) =>
                    setSelectedWorkflowId(
                      event.target.value,
                    )
                  }
                  className="mt-1.5 w-full rounded-lg border border-border/70 bg-background px-3 py-2.5 text-xs text-foreground outline-none transition-colors focus:border-primary"
                >
                  <option value="">
                    Select a workflow
                  </option>

                  {workflows.map((workflow) => (
                    <option
                      key={workflow.id}
                      value={workflow.id}
                    >
                      {workflow.name}
                    </option>
                  ))}
                </select>

                {selectedWorkflow ? (
                  <div className="mt-3 rounded-lg bg-muted/40 p-3">
                    <p className="text-xs font-medium text-foreground">
                      {selectedWorkflow.name}
                    </p>

                    {selectedWorkflow.description ? (
                      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                        {selectedWorkflow.description}
                      </p>
                    ) : null}

                    <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700">
                      {selectedWorkflow.status}
                    </span>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={prepareWorkflow}
                  disabled={!selectedWorkflowId}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Workflow size={14} />
                  Use This Workflow
                  <ArrowRight size={14} />
                </button>
              </>
            )}
          </>
        ) : null}

        {state === 'ready' ? (
          <>
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/40 p-3">
              <CheckCircle2
                size={16}
                className="mt-0.5 shrink-0 text-primary"
              />

              <div>
                <p className="text-xs font-medium text-foreground">
                  Workflow ready
                </p>

                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  {selectedWorkflow?.name ??
                    'Selected workflow'}{' '}
                  will receive this Decision Engine
                  context through the native Automation
                  Engine.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={executeAction}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Play size={14} />
              Execute Action
            </button>
          </>
        ) : null}

        {state === 'executing' ? (
          <div className="mt-3 rounded-lg bg-muted/40 p-3">
            <div className="flex items-center gap-2">
              <RefreshCw
                size={15}
                className="animate-spin text-primary"
              />

              <p className="text-xs font-medium text-foreground">
                Executing workflow…
              </p>
            </div>

            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              TechUnified Automation Engine is
              processing the selected workflow.
            </p>
          </div>
        ) : null}

        {state === 'success' ? (
          <div className="mt-3 rounded-lg bg-muted/40 p-3">
            <div className="flex items-start gap-2">
              <CheckCircle2
                size={16}
                className="mt-0.5 shrink-0 text-primary"
              />

              <div>
                <p className="text-xs font-medium text-foreground">
                  Action executed
                </p>

                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  {selectedWorkflow?.name ??
                    'The selected workflow'}{' '}
                  completed successfully.
                </p>

                {executionId ? (
                  <p className="mt-2 break-all text-[10px] text-muted-foreground/70">
                    Execution ID: {executionId}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {state === 'error' ? (
          <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <p className="text-xs font-medium text-destructive">
              Action failed
            </p>

            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              Check the workflow configuration and
              Automation Engine execution history.
            </p>

            <button
              type="button"
              onClick={() => {
                setState('selecting')
                setMessage('')
                void loadActiveWorkflows()
              }}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <RefreshCw size={14} />
              Try Again
            </button>
          </div>
        ) : null}
      </div>

      {message ? (
        <p
          className={`mt-3 text-xs leading-5 ${
            state === 'error'
              ? 'text-destructive'
              : 'text-muted-foreground'
          }`}
        >
          {message}
        </p>
      ) : null}

      <p className="mt-3 text-[10px] text-muted-foreground/70">
        Decision ID: {decisionId}
      </p>
    </div>
  )
}
