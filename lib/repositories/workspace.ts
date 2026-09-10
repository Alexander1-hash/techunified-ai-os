import { createClient } from '@/lib/supabase/client'
import type { Agent, Activity, Department } from '@/lib/data'

export type WorkspaceError = Error | null
export type WorkspaceDocument = { id: string; organization_id: string; name: string; source: string | null; status: string; metadata: Record<string, unknown>; created_at: string; updated_at: string }
export type WorkspaceMetric = { id: string; organization_id: string; metric_name: string; metric_value: number; recorded_at: string }
export type WorkspaceWorkflow = { id: string; organization_id: string; name: string; description: string; status: string; configuration: Record<string, unknown>; created_at: string; updated_at: string }

const getOrganizationId = async () => {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!user) return null
  const { data: profile, error } = await supabase.from('profiles').select('organization_id').eq('id', user.id).maybeSingle()
  if (error) throw new Error(error.message)
  return profile?.organization_id ?? null
}

export async function getWorkspaceData() {
  const supabase = createClient()
  const organizationId = await getOrganizationId()
  if (!organizationId) return { organizationId: null, agents: [], departments: [], workflows: [], documents: [], activity: [], metrics: [] as WorkspaceMetric[] }
  const [agentsResult, departmentsResult, workflowsResult, documentsResult, activityResult, metricsResult] = await Promise.all([
    supabase.from('agents').select('id, organization_id, department_id, name, purpose, status, configuration, created_at, updated_at').order('created_at', { ascending: false }),
    supabase.from('departments').select('id, organization_id, name, description, created_at, updated_at').order('name'),
    supabase.from('workflows').select('id, organization_id, name, description, status, configuration, created_at, updated_at').order('created_at', { ascending: false }),
    supabase.from('knowledge_documents').select('id, organization_id, name, source, status, metadata, created_at, updated_at').order('created_at', { ascending: false }),
    supabase.from('activity_logs').select('id, organization_id, actor_id, event_type, description, metadata, created_at').order('created_at', { ascending: false }).limit(20),
    supabase.from('analytics_metrics').select('id, organization_id, metric_name, metric_value, recorded_at').order('recorded_at', { ascending: false }),
  ])
  const failure = [agentsResult, departmentsResult, workflowsResult, documentsResult, activityResult, metricsResult].find(result => result.error)
  if (failure?.error) throw new Error(failure.error.message)
  const departmentNames = new Map((departmentsResult.data ?? []).map(department => [department.id, department.name]))
  const agents = (agentsResult.data ?? []).map((agent) => ({ ...agent, department: departmentNames.get(agent.department_id ?? '') ?? 'Unassigned', model: typeof agent.configuration?.model === 'string' ? agent.configuration.model : 'Configured', lastActivity: agent.updated_at ? new Date(agent.updated_at).toLocaleDateString() : 'No activity', tasks: 0 })) as Agent[]
  const departments = (departmentsResult.data ?? []).map((department) => { const departmentAgents = (agentsResult.data ?? []).filter((agent) => agent.department_id === department.id); return { ...department, agents: departmentAgents.length, active: departmentAgents.filter((agent) => ['running','active'].includes(agent.status.toLowerCase())).length, icon: '◈', status: 'Operational' } }) as Department[]
  const activity = (activityResult.data ?? []).map((item) => ({ actor: item.actor_id ? 'Team member' : 'System', action: item.description, department: item.event_type, status: 'Success', time: new Date(item.created_at).toLocaleString() })) as Activity[]
  return { organizationId, agents, departments, workflows: (workflowsResult.data ?? []) as WorkspaceWorkflow[], documents: (documentsResult.data ?? []) as WorkspaceDocument[], activity, metrics: (metricsResult.data ?? []) as WorkspaceMetric[] }
}

export async function getAgent(agentId: string) {
  const supabase = createClient()
  const organizationId = await getOrganizationId()
  if (!organizationId) return null
  const { data, error } = await supabase.from('agents').select('id, organization_id, department_id, name, purpose, status, configuration, created_at, updated_at').eq('id', agentId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data || data.organization_id !== organizationId) return null
  return data
}

export { getOrganizationId }

export const workspaceFetcher = () => getWorkspaceData()
