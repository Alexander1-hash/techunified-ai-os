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
  const [outcomes, actionRuns, memories] = await Promise.all([
    supabase.from('business_outcomes')
      .select('id,title,outcome_type,evidence_status,hours_saved,cost_avoided,revenue_impact,currency,action_run_id,created_at')
      .eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(10),
    supabase.from('business_action_runs')
      .select('id,decision_id,decision_title,workflow_id,execution_id,status,output,created_at')
      .eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(10),
    supabase.from('agent_memory')
      .select('id,memory_type,content,importance,metadata,created_at')
      .eq('organization_id', organizationId).eq('agent_id', agentId)
      .order('importance', { ascending: false }).order('created_at', { ascending: false }).limit(20),
  ])
  return {
    recentOutcomes: outcomes.data ?? [],
    recentActionRuns: actionRuns.data ?? [],
    memories: memories.data ?? [],
  }
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

  const { data: run, error: runError } = await supabase.from('agent_runs').insert({
    organization_id: organizationId, agent_id: agentId, created_by: userId, task,
    status: 'running', autonomy_mode: autonomyMode, requires_approval: requiresApproval,
    approval_status: requiresApproval ? 'pending' : 'not_required',
    context_snapshot: context, started_at: new Date().toISOString(),
  }).select('id').single()

  if (runError || !run) throw runError ?? new Error('Unable to create agent run.')
  if (!process.env.OPENAI_API_KEY?.trim()) {
    await supabase.from('agent_runs').update({ status: 'failed', error_message: 'AI provider configuration is missing.', completed_at: new Date().toISOString() }).eq('id', run.id).eq('organization_id', organizationId)
    throw new Error('AI provider configuration is missing.')
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const model = config.model?.trim() || process.env.OPENAI_MODEL?.trim() || 'gpt-5.6-luna'

  try {
    const response = await openai.responses.create({
      model,
      input: [
        { role: 'developer', content:
          'You are a governed business AI worker inside TechUnified AI OS. ' +
          'Reason only from supplied organizational context. Never invent company facts, customers, revenue, savings, permissions, or completed actions. ' +
          'You may analyze and recommend. If approval is pending, produce a proposed plan rather than pretending to execute it. ' +
          'Separate observed facts, calculations, assumptions, recommendations, and proposed actions. Keep the result concise and operational.' },
        { role: 'user', content:
          'Agent: ' + config.name + '\n' +
          'Purpose: ' + (config.purpose ?? config.description ?? 'Business AI worker') + '\n' +
          'Autonomy mode: ' + autonomyMode + '\n' +
          'Approval status: ' + (requiresApproval ? 'pending' : 'not required') + '\n\n' +
          'Task:\n' + task + '\n\nContext:\n' + JSON.stringify(context) },
      ],
    })

    const output = response.output_text?.trim() || 'The agent returned no result.'
    const result = { text: output, autonomyMode, requiresApproval, approvalStatus: requiresApproval ? 'pending' : 'not_required' }

    await supabase.from('agent_runs').update({ status: 'completed', result, completed_at: new Date().toISOString() }).eq('id', run.id).eq('organization_id', organizationId)
    await supabase.from('agent_memory').insert({
      organization_id: organizationId, agent_id: agentId, run_id: run.id, memory_type: 'working',
      content: 'Task: ' + task + '\nResult: ' + output.slice(0, 4000),
      importance: 50, metadata: { autonomyMode, requiresApproval },
    })

    return { runId: run.id, agent: { id: config.id, name: config.name }, status: 'completed', ...result }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agent execution failed.'
    await supabase.from('agent_runs').update({ status: 'failed', error_message: message, completed_at: new Date().toISOString() }).eq('id', run.id).eq('organization_id', organizationId)
    throw new Error('Agent execution failed.')
  }
}
