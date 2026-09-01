import { NextResponse } from 'next/server'
import { getBusinessIdentity, getBusinessTable } from '@/lib/business/repository'

export async function GET() {
  const identity = await getBusinessIdentity()
  if (!identity.user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (!identity.organizationId) return NextResponse.json({ error: 'No organization is assigned to this profile.' }, { status: 403 })
  const [objectives, kpis, insights, recommendations, reports, dataSources] = await Promise.all([
    getBusinessTable('company_objectives'), getBusinessTable('business_kpis'), getBusinessTable('business_insights'),
    getBusinessTable('business_recommendations'), getBusinessTable('business_reports'), getBusinessTable('business_data_sources'),
  ])
  return NextResponse.json({ organization: identity.organization, objectives: objectives.data, kpis: kpis.data, insights: insights.data, recommendations: recommendations.data, reports: reports.data, dataSources: dataSources.data })
}
