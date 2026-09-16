import { createClient } from '@/lib/supabase/server'

const agentSelect =
  'id, organization_id, department_id, name, description, purpose, instructions, status, autonomy_level, model, tools, knowledge_sources, last_activity_at, created_at, updated_at'

export async function getServerAgent(agentId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile?.organization_id) {
    return null
  }

  const { data: agent, error } = await supabase
    .from('agents')
    .select(agentSelect)
    .eq('id', agentId)
    .eq('organization_id', profile.organization_id)
    .maybeSingle()

  if (error || !agent) {
    return null
  }

  return agent
}

export async function getServerDepartment(departmentId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.organization_id) {
    return null
  }

  const [departmentResult, agentsResult] = await Promise.all([
    supabase
      .from('departments')
      .select(
        'id, organization_id, name, description, created_at, updated_at',
      )
      .eq('id', departmentId)
      .maybeSingle(),

    supabase
      .from('agents')
      .select(agentSelect)
      .eq('department_id', departmentId)
      .eq('organization_id', profile.organization_id)
      .order('name'),
  ])

  if (
    !departmentResult.data ||
    departmentResult.data.organization_id !== profile.organization_id
  ) {
    return null
  }

  if (agentsResult.error) {
    throw new Error(agentsResult.error.message)
  }

  return {
    department: departmentResult.data,
    agents: agentsResult.data ?? [],
  }
}
