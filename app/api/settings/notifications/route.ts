import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MISSING_TABLE = new Set(['42P01', 'PGRST205'])
const FLAGS = ['email_enabled', 'product_updates', 'workflow_alerts', 'security_alerts'] as const

function missingTableResponse() {
  return NextResponse.json(
    { error: 'Notification preferences storage is not set up yet. Run the settings_foundation migration in Supabase to enable it.', notReady: true },
    { status: 503 },
  )
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in to continue.' }, { status: 401 })

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('email_enabled, product_updates, workflow_alerts, security_alerts')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    if (MISSING_TABLE.has(error.code)) return missingTableResponse()
    console.error('[settings/notifications] read failed:', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'We could not load your notification preferences.' }, { status: 400 })
  }
  return NextResponse.json({ preferences: data })
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in to continue.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })

  for (const flag of FLAGS) {
    if (typeof body[flag] !== 'boolean') return NextResponse.json({ error: 'Each notification setting must be true or false.' }, { status: 400 })
  }

  const payload = {
    user_id: user.id,
    email_enabled: body.email_enabled as boolean,
    product_updates: body.product_updates as boolean,
    workflow_alerts: body.workflow_alerts as boolean,
    security_alerts: body.security_alerts as boolean,
  }

  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert(payload, { onConflict: 'user_id' })
    .select('email_enabled, product_updates, workflow_alerts, security_alerts')
    .single()

  if (error) {
    if (MISSING_TABLE.has(error.code)) return missingTableResponse()
    console.error('[settings/notifications] save failed:', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'We could not save your notification preferences.' }, { status: 400 })
  }
  return NextResponse.json({ preferences: data })
}
