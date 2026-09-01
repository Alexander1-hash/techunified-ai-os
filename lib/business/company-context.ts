import { createClient } from '@/lib/supabase/server'

export interface CompanyContext { organization: { id: string; name: string; industry: string | null } | null; objectives: unknown[]; kpis: unknown[]; dataSources: unknown[]; knowledgeCount: number; dataQuality: 'Good' | 'Warning' | 'Poor' }

export async function getCompanyContext(): Promise<CompanyContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { organization: null, objectives: [], kpis: [], dataSources: [], knowledgeCount: 0, dataQuality: 'Poor' }
  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).maybeSingle()
  if (!profile?.organization_id) return { organization: null, objectives: [], kpis: [], dataSources: [], knowledgeCount: 0, dataQuality: 'Poor' }
  const { data: organization } = await supabase.from('organizations').select('id,name,industry').eq('id', profile.organization_id).maybeSingle()
  return { organization, objectives: [], kpis: [], dataSources: [], knowledgeCount: 0, dataQuality: 'Poor' }
}
