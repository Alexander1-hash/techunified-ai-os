import {
  executeAutomation,
  type ExecutionResult,
} from '@/lib/automation/engine'

export type DecisionActionType =
  | 'run_workflow'
  | 'analyze_with_ai'
  | 'generate_content'

export type DecisionAction = {
  type: DecisionActionType
  workflowId: string
  organizationId: string
  decisionId: string
  input?: Record<string, unknown>
}

export type DecisionActionResult = ExecutionResult & {
  decisionId: string
  actionType: DecisionActionType
}

function buildTriggerInput(
  action: DecisionAction,
): Record<string, unknown> {
  return {
    decisionId: action.decisionId,
    actionType: action.type,
    ...(action.input ?? {}),
  }
}

export async function executeDecisionAction(
  action: DecisionAction,
): Promise<DecisionActionResult> {
  if (!action.workflowId) {
    return {
      success: false,
      decisionId: action.decisionId,
      actionType: action.type,
      error: 'A workflow is required to execute a decision action.',
    }
  }

  if (!action.organizationId) {
    return {
      success: false,
      decisionId: action.decisionId,
      actionType: action.type,
      error:
        'An organization is required to execute a decision action.',
    }
  }

  if (!action.decisionId) {
    return {
      success: false,
      decisionId: '',
      actionType: action.type,
      error: 'A decision ID is required to execute a decision action.',
    }
  }

  const result = await executeAutomation(
    action.workflowId,
    action.organizationId,
    {
      type: `decision:${action.type}`,
      input: buildTriggerInput(action),
    },
  )

  return {
    ...result,
    decisionId: action.decisionId,
    actionType: action.type,
  }
}

export function isDecisionActionType(
  value: unknown,
): value is DecisionActionType {
  return (
    value === 'run_workflow' ||
    value === 'analyze_with_ai' ||
    value === 'generate_content'
  )
}
