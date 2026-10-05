import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

type RelationshipRow = {
  source_type: string
  target_type: string
  relationship_type: string
  evidence_status: string
  confidence: number | string | null
}

export async function GET() {
  const supabase = await createClient()
  const { profile } = await getCurrentProfile(supabase)
  const organizationId = profile?.organization_id

  if (!organizationId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const [{ data, error }, { data: relationships, error: relationshipError }] = await Promise.all([
    supabase
      .from('business_reports')
      .select('id,title,report_type,content,period,metadata,created_at,updated_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false }),
    supabase
      .from('business_relationships')
      .select('source_type,target_type,relationship_type,evidence_status,confidence')
      .eq('organization_id', organizationId),
  ])

  if (error) return NextResponse.json({ error: 'Unable to load reports.' }, { status: 500 })

  const relationshipRows: RelationshipRow[] = relationshipError ? [] : relationships ?? []
  const verified = relationshipRows.filter((row) => row.evidence_status === 'verified').length
  const evidenceByStatus = relationshipRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.evidence_status] = (acc[row.evidence_status] ?? 0) + 1
    return acc
  }, {})
  const relationshipTypes = relationshipRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.relationship_type] = (acc[row.relationship_type] ?? 0) + 1
    return acc
  }, {})
  const coveragePercent = relationshipRows.length
    ? Math.round((verified / relationshipRows.length) * 1000) / 10
    : 0

  return NextResponse.json({
    reports: data ?? [],
    relationshipIntelligence: {
      explicitRelationships: relationshipRows.length,
      verifiedRelationships: verified,
      coveragePercent,
      evidenceByStatus,
      relationshipTypes,
      available: !relationshipError,
      source: '/api/business/relationships/insights',
      methodology:
        'Reports expose relationship evidence as supporting intelligence. Unsupported profitability, cost, ROI, or causal automation claims remain unavailable until verified evidence exists.',
    },
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { profile } = await getCurrentProfile(supabase)
  const organizationId = profile?.organization_id
  const userId = profile?.id

  if (!organizationId || !userId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const reportType = typeof body?.report_type === 'string' ? body.report_type.trim() : 'business_analysis'
  const content = typeof body?.content === 'string' ? body.content.trim() : ''

  if (!title || !content) {
    return NextResponse.json({ error: 'Title and content are required.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('business_reports')
    .insert({
      organization_id: organizationId,
      title,
      report_type: reportType,
      content,
      period: typeof body?.period === 'string' ? body.period : null,
      metadata: body?.metadata && typeof body.metadata === 'object' ? body.metadata : {},
      created_by: userId,
    })
    .select('id,title,report_type,content,period,metadata,created_at,updated_at')
    .single()

  if (error) return NextResponse.json({ error: 'Unable to create report.' }, { status: 500 })

  return NextResponse.json({ report: data }, { status: 201 })
}
