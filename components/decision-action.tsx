'use client'

import { useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Play,
  Workflow,
  X,
} from 'lucide-react'

type DecisionActionProps = {
  decisionId: string
  decisionTitle: string
  decisionAction: string
}

type ActionState =
  | 'idle'
  | 'selecting'
  | 'ready'
  | 'executing'
  | 'success'

export function DecisionAction({
  decisionId,
  decisionTitle,
  decisionAction,
}: DecisionActionProps) {
  const [state, setState] =
    useState<ActionState>('idle')

  const [message, setMessage] =
    useState('')

  function openActionPanel() {
    setMessage('')
    setState('selecting')
  }

  function closeActionPanel() {
    if (state === 'executing') {
      return
    }

    setState('idle')
    setMessage('')
  }

  function selectWorkflow() {
    setMessage(
      'Workflow selection is ready. Connect this decision to an active workflow to execute it.',
    )

    setState('ready')
  }

  async function executeAction() {
    setState('executing')
    setMessage('Preparing action execution…')

    try {
      /*
       * The Automation Engine execution endpoint
       * will be connected after the existing workflow
       * contract is verified.
       *
       * We intentionally do not invent an API request
       * or pretend that a workflow has executed.
       */

      await new Promise((resolve) =>
        setTimeout(resolve, 700),
      )

      setState('success')

      setMessage(
        'Action prepared successfully. The next step is connecting the selected workflow to the Automation Engine.',
      )
    } catch {
      setState('ready')

      setMessage(
        'Unable to prepare this action.',
      )
    }
  }

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
        <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-primary">
          Workflow
        </p>

        {state === 'selecting' ? (
          <>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Select an active workflow to perform
              this action.
            </p>

            <button
              type="button"
              onClick={selectWorkflow}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Workflow size={14} />
              Select Active Workflow
              <ArrowRight size={14} />
            </button>
          </>
        ) : null}

        {state === 'ready' ? (
          <>
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted/40 p-3">
              <CheckCircle2
                size={16}
                className="text-primary"
              />

              <div>
                <p className="text-xs font-medium text-foreground">
                  Workflow selected
                </p>

                <p className="text-[11px] text-muted-foreground">
                  Ready for Automation Engine execution.
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
          <div className="mt-2 rounded-lg bg-muted/40 p-3">
            <p className="text-xs font-medium text-foreground">
              Executing action…
            </p>

            <p className="mt-1 text-[11px] text-muted-foreground">
              Preparing the workflow execution.
            </p>
          </div>
        ) : null}

        {state === 'success' ? (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted/40 p-3">
            <CheckCircle2
              size={16}
              className="text-primary"
            />

            <div>
              <p className="text-xs font-medium text-foreground">
                Action prepared
              </p>

              <p className="text-[11px] text-muted-foreground">
                Ready for the Automation Engine.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {message ? (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          {message}
        </p>
      ) : null}

      <p className="mt-3 text-[10px] text-muted-foreground/70">
        Decision ID: {decisionId}
      </p>
    </div>
  )
}
