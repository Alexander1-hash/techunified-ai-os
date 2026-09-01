import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const tables = ['company_objectives', 'business_kpis', 'business_insights', 'business_recommendations', 'business_reports', 'business_data_sources'] as const

type BusinessTable = typeof tables[number]

async function getOrganizationId() {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return { client, user: null, organizationId: null }
  const { data: profile } = await client.from('profiles').select('organization_id').eq('id', user.id).maybeSingle()
  return { client, user, organizationId: profile?.organization_id ?? null }
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null
}

export async function getBusinessTable<T = Record<string, unknown>>(table: BusinessTable, limit = 100) {
  const { client, user, organizationId } = await getOrganizationId()
  if (!user || !organizationId) return { user, organizationId, data: [] as T[], error: null }
  const queryClient = adminClient() ?? client
  const { data, error } = await queryClient.from(table).select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(limit)
  return { user, organizationId, data: (data ?? []) as T[], error }
}

export async function insertBusinessRecord(table: BusinessTable, payload: Record<string, unknown>) {
  const { client, user, organizationId } = await getOrganizationId()
  if (!user || !organizationId) return { error: new Error('Unauthorized') }
  const queryClient = adminClient() ?? client
  return queryClient.from(table).insert({ ...payload, organization_id: organizationId }).select().single()
}

export async function getBusinessIdentity() {
  const { client, user, organizationId } = await getOrganizationId()
  if (!user || !organizationId) return { user, organizationId: null, organization: null }
  const queryClient = adminClient() ?? client
  const { data: organization } = await queryClient.from('organizations').select('id,name,description,industry,website,timezone,plan').eq('id', organizationId).maybeSingle()
  return { user, organizationId, organization }
}
