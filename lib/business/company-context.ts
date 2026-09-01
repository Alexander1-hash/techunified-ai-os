import { createClient } from '@/lib/supabase/server'

import { getBusinessIdentity, getBusinessTable } from '@/lib/business/repository'

export interface CompanyContext { organization: { id: string; name: string; industry: string | null; description?: string | null; website?: string | null; timezone?: string | null; plan?: string | null } | null; objectives: unknown[]; kpis: unknown[]; insights: unknown[]; recommendations: unknown[]; reports: unknown[]; dataSources: unknown[]; knowledgeCount: number; dataQuality: 'Good' | 'Warning' | 'Poor' }

export async function getCompanyContext(): Promise<CompanyContext> {
  const identity = await getBusinessIdentity()
  const empty = { organization: identity.organization, objectives: [], kpis: [], insights: [], recommendations: [], reports: [], dataSources: [], knowledgeCount: 0, dataQuality: 'Poor' as const }
  if (!identity.user || !identity.organizationId) return empty
  const [objectives, kpis, insights, recommendations, reports, dataSources] = await Promise.all([
    getBusinessTable('company_objectives'), getBusinessTable('business_kpis'), getBusinessTable('business_insights'),
    getBusinessTable('business_recommendations'), getBusinessTable('business_reports'), getBusinessTable('business_data_sources'),
  ])
  const count = kpis.data.length + objectives.data.length + dataSources.data.length
  return { ...empty, objectives: objectives.data, kpis: kpis.data, insights: insights.data, recommendations: recommendations.data, reports: reports.data, dataSources: dataSources.data, dataQuality: count > 0 ? 'Good' : 'Poor' }
}
