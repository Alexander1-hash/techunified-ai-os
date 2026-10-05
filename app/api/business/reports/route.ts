import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

export async function GET() {
  const supabase = await createClient()
  const { profile } = await getCurrentProfile(supabase)
  const organizationId = profile?.organization_id

  if (!organizationId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('business_reports')
    .select('id,title,report_type,content,period,metadata,created_at,updated_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Unable to load reports.' }, { status: 500 })

  return NextResponse.json({ reports: data ?? [] })
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
