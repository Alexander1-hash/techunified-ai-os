import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

type AgentConfig = {
  id: string
  name: string
  purpose: string | null
  description: string | null
  status: string | null
  autonomy_level: number | null
  model: string | null
}

type ToolPermission = {
  tool_key: string
  name: string
  description: string
  risk_level: 'read' | 'propose' | 'action'
  input_schema: Record<string, unknown>
}

function normalizeAutonomy(level: number | null) {
  if (typeof level !== 'number') return 'assist'
  if (level >= 80) return 'bounded'
  if (level >= 40) return 'supervised'
  return 'assist'
}

async function loadContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  agentId: string,
) {
  const [outcomes, actionRuns, memories, evaluations] = await Promise.all([
    supabase.from('business_outcomes')
      .select('id,title,outcome_type,evidence_status,hours_saved,cost_avoided,revenue_impact,currency,action_run_id,created_at')
      .eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(10),
    supabase.from('business_action_runs')
      .select('id,decision_id,decision_title,workflow_id,execution_id,status,output,created_at')
      .eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(10),
    supabase.from('agent_memory')
      .select('id,memory_type,content,importance,confidence,evidence_status,source_type,source_id,metadata,created_at')
      .eq('organization_id', organizationId).eq('agent_id', agentId).is('superseded_at', null)
      .order('confidence', { ascending: false }).order('importance', { ascending: false }).order('created_at', { ascending: false }).limit(30),
    supabase.from('agent_evaluations')
      .select('groundedness_score,tool_accuracy_score,execution_success,outcome_linked,human_feedback,reviewer_note,created_at')
      .eq('organization_id', organizationId).eq('agent_id', agentId).order('created_at', { ascending: false }).limit(10),
  ])
  const evaluationRows = evaluations.data ?? []
  const scoredGroundedness = evaluationRows.map((row) => row.groundedness_score).filter((value): value is number => typeof value === 'number')
  const scoredToolAccuracy = evaluationRows.map((row) => row.tool_accuracy_score).filter((value): value is number => typeof value === 'number')
  const performance = {
    evaluationCount: evaluationRows.length,
    averageGroundedness: scoredGroundedness.length ? Math.round(scoredGroundedness.reduce((a, b) => a + b, 0) / scoredGroundedness.length) : null,
    averageToolAccuracy: scoredToolAccuracy.length ? Math.round(scoredToolAccuracy.reduce((a, b) => a + b, 0) / scoredToolAccuracy.length) : null,
    successfulExecutions: evaluationRows.filter((row) => row.execution_success === true).length,
    failedExecutions: evaluationRows.filter((row) => row.execution_success === false).length,
    outcomeLinkedEvaluations: evaluationRows.filter((row) => row.outcome_linked).length,
  }
  return {
    recentOutcomes: outcomes.data ?? [],
    recentActionRuns: actionRuns.data ?? [],
    memories: memories.data ?? [],
    evaluations: evaluationRows,
    performance,
  }
}

async function runTool(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  toolKey: string,
  args: Record<string, unknown>,
) {
  if (toolKey === 'company_brain.search') {
    const query = typeof args.query === 'string' ? args.query.trim() : ''
    if (!query) return { error: 'query is required' }

    const terms = query.toLowerCase().split(/\s+/)
      .map((term) => term.replace(/[^\p{L}\p{N}_-]/gu, ''))
      .filter((term) => term.length >= 2)
      .slice(0, 8)

    if (!terms.length) return { results: [] }

    const fullSearch = terms.join(' & ')
    const { data, error } = await supabase
      .from('knowledge_chunks')
      .select('id,document_id,content,chunk_index,metadata')
      .eq('organization_id', organizationId)
      .textSearch('content', fullSearch)
      .limit(5)

    if (error) return { error: 'Company Brain search failed.' }

    const documentIds = [...new Set((data ?? []).map((row) => row.document_id))]
    const { data: documents } = documentIds.length
      ? await supabase.from('knowledge_documents')
          .select('id,name')
          .eq('organization_id', organizationId)
          .in('id', documentIds)
      : { data: [] }

    const names = new Map((documents ?? []).map((document) => [document.id, document.name]))
    return {
      results: (data ?? []).map((row) => ({
        source: names.get(row.document_id) ?? 'Knowledge document',
        excerpt: row.content.slice(0, 900),
      })),
    }
  }

  if (toolKey === 'business_analyst.snapshot') {
    const [kpis, outcomes, sources] = await Promise.all([
      supabase.from('business_kpis')
        .select('name,value,previous_value,unit,period,trend,status,source,recorded_at')
        .eq('organization_id', organizationId).order('recorded_at', { ascending: false }).limit(50),
      supabase.from('business_outcomes')
        .select('title,outcome_type,evidence_status,hours_saved,cost_avoided,revenue_impact,implementation_cost,currency,action_run_id,created_at')
        .eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(20),
      supabase.from('business_data_sources')
        .select('name,provider,status,last_synced_at')
        .eq('organization_id', organizationId).limit(20),
    ])

    if (kpis.error || outcomes.error || sources.error) return { error: 'Business Analyst data is unavailable.' }

    const verified = (outcomes.data ?? []).filter((row) => ['measured', 'attributed'].includes(row.evidence_status))
    return {
      kpis: kpis.data ?? [],
      sources: sources.data ?? [],
      verifiedOutcomeCount: verified.length,
      verifiedOutcomes: verified,
    }
  }

  if (toolKey === 'business_outcomes.recent') {
    const requested = Number(args.limit)
    const limit = Number.isFinite(requested) ? Math.min(20, Math.max(1, requested)) : 10
    const { data, error } = await supabase
      .from('business_outcomes')
      .select('id,title,outcome_type,evidence_status,baseline_value,current_value,unit,hours_saved,cost_avoided,revenue_impact,implementation_cost,currency,action_run_id,source,period_start,period_end,created_at')
      .eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(limit)

    if (error) return { error: 'Business outcomes are unavailable.' }
    return { outcomes: data ?? [] }
  }

  if (toolKey === 'workflow.propose_action') {
    const workflowId = typeof args.workflow_id === 'string' ? args.workflow_id.trim() : ''
    const reason = typeof args.reason === 'string' ? args.reason.trim() : ''
    if (!reason) return { error: 'reason is required' }

    const query = supabase.from('workflows')
      .select('id,name,status')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .limit(25)

    const { data, error } = workflowId
      ? await query.eq('id', workflowId)
      : await query

    if (error) return { error: 'Unable to inspect active workflows.' }
    if (workflowId && !(data ?? []).length) return { error: 'The requested workflow is not active or not found.' }

    return {
      proposal: {
        workflow: data?.[0] ?? null,
        workflowId: data?.[0]?.id ?? null,
        reason,
        input: args.input && typeof args.input === 'object' ? args.input : {},
        execution: 'not_executed',
        approvalRequired: true,
      },
      availableActiveWorkflows: data ?? [],
    }
  }

  return { error: 'Tool is not available.' }
}

export async function runGovernedAgent(agentId: string, task: string, userId: string) {
  const supabase = await createClient()
  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', userId).maybeSingle()
  const organizationId = profile?.organization_id
  if (!organizationId) throw new Error('Your account is not connected to an organization.')

  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id,name,purpose,description,status,autonomy_level,model')
    .eq('id', agentId).eq('organization_id', organizationId).maybeSingle()

  if (agentError) throw agentError
  if (!agent) throw new Error('Agent not found.')
  if (!['active', 'running'].includes(String(agent.status))) throw new Error('The selected agent is not active.')

  const config = agent as AgentConfig
  const autonomyMode = normalizeAutonomy(config.autonomy_level)
  const requiresApproval = autonomyMode !== 'bounded'
  const context = await loadContext(supabase, organizationId, agentId)

  const { data: permissions, error: permissionsError } = await supabase
    .from('agent_tool_permissions')
    .select('enabled,agent_tools!inner(tool_key,name,description,risk_level,input_schema,enabled)')
    .eq('organization_id', organizationId)
    .eq('agent_id', agentId)
    .eq('enabled', true)

  if (permissionsError) throw permissionsError

  const tools: ToolPermission[] = (permissions ?? [])
    .map((row: any) => {
      const tool = Array.isArray(row.agent_tools) ? row.agent_tools[0] : row.agent_tools
      if (!tool || tool.enabled !== true) return null
      return tool as ToolPermission
    })
    .filter(Boolean) as ToolPermission[]

  const { data: run, error: runError } = await supabase.from('agent_runs').insert({
    organization_id: organizationId, agent_id: agentId, created_by: userId, task,
    status: 'running', autonomy_mode: autonomyMode, requires_approval: requiresApproval,
    approval_status: requiresApproval ? 'pending' : 'not_required',
    context_snapshot: { ...context, availableTools: tools.map((tool) => tool.tool_key) },
    started_at: new Date().toISOString(),
  }).select('id').single()

  if (runError || !run) throw runError ?? new Error('Unable to create agent run.')
  if (!process.env.OPENAI_API_KEY?.trim()) {
    await supabase.from('agent_runs').update({ status: 'failed', error_message: 'AI provider configuration is missing.', completed_at: new Date().toISOString() }).eq('id', run.id).eq('organization_id', organizationId)
    throw new Error('AI provider configuration is missing.')
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const model = config.model?.trim() || process.env.OPENAI_MODEL?.trim() || 'gpt-5.6-luna'
  const toolDefinitions = tools.map((tool) => ({
    type: 'function' as const,
    name: tool.tool_key,
    description: tool.description,
    parameters: tool.input_schema,
    strict: true,
  }))

  const toolCalls: Array<Record<string, unknown>> = []
  let input: any[] = [
    {
      role: 'developer',
      content:
        'You are a governed business AI worker inside TechUnified AI OS. ' +
        'Use only the supplied organization context and the explicitly permitted tools. ' +
        'Never invent company facts, customers, revenue, savings, permissions, or completed actions. ' +
        'Read tools may inspect organization data. Proposal tools may prepare an action but never execute it. ' +
        'Never claim a workflow or business action ran unless a completed action result is supplied. ' +
        'Separate observed facts, calculations, assumptions, recommendations, and proposed actions. ' +
        'If approval is pending, recommendations and proposals must remain non-executing. ' +
        'Treat explicit human feedback as authoritative guidance, verified outcomes as evidence, and unverified run memories as hypotheses. ' +
        'Use the supplied performance summary to improve reasoning quality, but do not fabricate missing scores or outcomes.',
    },
    {
      role: 'user',
      content:
        'Agent: ' + config.name + '\n' +
        'Purpose: ' + (config.purpose ?? config.description ?? 'Business AI worker') + '\n' +
        'Autonomy mode: ' + autonomyMode + '\n' +
        'Approval status: ' + (requiresApproval ? 'pending' : 'not required') + '\n\n' +
        'Task:\n' + task + '\n\nInitial context:\n' + JSON.stringify(context),
    },
  ]

  try {
    let response: any = null

    for (let step = 0; step < 6; step += 1) {
      response = await openai.responses.create({
        model,
        input,
        ...(toolDefinitions.length ? { tools: toolDefinitions } : {}),
        tool_choice: toolDefinitions.length ? 'auto' : 'none',
      })

      const calls = (response.output ?? []).filter((item: any) => item.type === 'function_call')
      if (!calls.length) break

      input = [...input, ...response.output]

      for (const call of calls) {
        const permitted = tools.find((tool) => tool.tool_key === call.name)
        if (!permitted) {
          const denied = { error: 'Tool permission denied.' }
          toolCalls.push({ name: call.name, status: 'denied', arguments: call.arguments })
          input.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(denied) })
          continue
        }

        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(call.arguments || '{}')
        } catch {
          args = {}
        }

        const result = await runTool(supabase, organizationId, call.name, args)
        toolCalls.push({
          name: call.name,
          status: 'completed',
          riskLevel: permitted.risk_level,
          arguments: args,
          result,
        })
        input.push({
          type: 'function_call_output',
          call_id: call.call_id,
          output: JSON.stringify(result),
        })
      }

      if (step === 5) {
        throw new Error('Agent tool loop reached the safety limit.')
      }
    }

    const output = response?.output_text?.trim() || 'The agent returned no result.'
    const result = {
      text: output,
      autonomyMode,
      requiresApproval,
      approvalStatus: requiresApproval ? 'pending' : 'not_required',
      toolCount: toolCalls.length,
    }

    await supabase.from('agent_runs').update({
      status: 'completed',
      tool_calls: toolCalls,
      result,
      completed_at: new Date().toISOString(),
    }).eq('id', run.id).eq('organization_id', organizationId)

    await supabase.from('agent_memory').insert({
      organization_id: organizationId,
      agent_id: agentId,
      run_id: run.id,
      memory_type: 'working',
      content: 'Task: ' + task + '\nResult: ' + output.slice(0, 4000),
      importance: 40,
      confidence: 30,
      evidence_status: 'unverified',
      source_type: 'run',
      source_id: run.id,
      metadata: { autonomyMode, requiresApproval, toolCount: toolCalls.length },
    })

    return {
      runId: run.id,
      agent: { id: config.id, name: config.name },
      status: 'completed',
      ...result,
      tools: toolCalls.map((call) => ({ name: call.name, status: call.status, riskLevel: call.riskLevel ?? null })),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agent execution failed.'
    await supabase.from('agent_runs').update({
      status: 'failed',
      tool_calls: toolCalls,
      error_message: message,
      completed_at: new Date().toISOString(),
    }).eq('id', run.id).eq('organization_id', organizationId)
    throw new Error('Agent execution failed.')
  }
}
