import { createClient } from '@/lib/supabase/server'

export async function getServerAgent(agentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile, error: profileError } = await supabase.from('profiles').select('organization_id').eq('id', user.id).maybeSingle()
  if (profileError || !profile?.organization_id) return null
  const { data: agent, error } = await supabase.from('agents').select('id, organization_id, department_id, name, purpose, status, configuration, created_at, updated_at').eq('id', agentId).maybeSingle()
  if (error || !agent || agent.organization_id !== profile.organization_id) return null
  return agent
}

export async function getServerDepartment(departmentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).maybeSingle()
  if (!profile?.organization_id) return null
  const [departmentResult, agentsResult] = await Promise.all([
    supabase.from('departments').select('id, organization_id, name, description, created_at, updated_at').eq('id', departmentId).maybeSingle(),
    supabase.from('agents').select('id, organization_id, department_id, name, purpose, status, configuration, created_at, updated_at').eq('department_id', departmentId).order('name'),
  ])
  if (!departmentResult.data || departmentResult.data.organization_id !== profile.organization_id) return null
  return { department: departmentResult.data, agents: agentsResult.data ?? [] }
}
