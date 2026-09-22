import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'
import {
  executeDecisionAction,
  isDecisionActionType,
} from '@/lib/automation/decision-actions'

type ActionRequest = {
  decisionId?: string
  actionType?: string
  workflowId?: string
  input?: Record<string, unknown>
}

export async function POST(
  request: Request,
) {
  try {
    const supabase = await createClient()

    const { profile } =
      await getCurrentProfile(supabase)

    const organizationId =
      profile?.organization_id

    if (!organizationId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required.',
        },
        { status: 401 },
      )
    }

    let body: ActionRequest

    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body.',
        },
        { status: 400 },
      )
    }

    const decisionId =
      String(body.decisionId ?? '').trim()

    const actionType =
      String(body.actionType ?? '').trim()

    const workflowId =
      String(body.workflowId ?? '').trim()

    if (!decisionId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Decision ID is required.',
        },
        { status: 400 },
      )
    }

    if (!isDecisionActionType(actionType)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid decision action type.',
        },
        { status: 400 },
      )
    }

    if (!workflowId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Workflow ID is required.',
        },
        { status: 400 },
      )
    }

    /*
     * Verify that the selected workflow
     * belongs to the current organization.
     *
     * The automation engine performs its
     * own organization-scoped lookup too,
     * but we validate here before execution
     * so the API never accepts a workflow
     * from another organization.
     */
    const { data: workflow, error } =
      await supabase
        .from('workflows')
        .select(
          'id, organization_id, name, status',
        )
        .eq('id', workflowId)
        .eq(
          'organization_id',
          organizationId,
        )
        .maybeSingle()

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Unable to verify the selected workflow.',
        },
        { status: 500 },
      )
    }

    if (!workflow) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Workflow not found for this organization.',
        },
        { status: 404 },
      )
    }

    if (
      String(workflow.status).toLowerCase() !==
      'active'
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'The selected workflow is not active.',
        },
        { status: 409 },
      )
    }

    const result =
      await executeDecisionAction({
        type: actionType,
        workflowId,
        organizationId,
        decisionId,
        input: body.input,
      })

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          decisionId,
          actionType,
          workflow: {
            id: workflow.id,
            name: workflow.name,
            status: workflow.status,
          },
          executionId:
            result.executionId ?? null,
          error:
            result.error ??
            'Decision action failed.',
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      decisionId,
      actionType,
      workflow: {
        id: workflow.id,
        name: workflow.name,
        status: workflow.status,
      },
      executionId:
        result.executionId ?? null,
      output:
        result.output ?? {},
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to execute decision action.',
      },
      { status: 500 },
    )
  }
}
