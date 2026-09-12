import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getN8nConfiguration, safeIntegrationError } from '@/lib/integrations/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ connected: false, error: 'Authentication required.' }, { status: 401 })

  const configuration = getN8nConfiguration()
  if (!configuration.configured) return NextResponse.json({ connected: false, error: 'n8n webhook configuration is missing.' }, { status: 503 })

  const url = new URL(configuration.webhookUrl)
  if (!['http:', 'https:'].includes(url.protocol)) return NextResponse.json({ connected: false, error: 'n8n webhook configuration is invalid.' }, { status: 400 })

  try {
    const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(8000), cache: 'no-store' })
    return NextResponse.json({ connected: response.ok, configured: true, message: response.ok ? 'Webhook configured. A live workflow test requires a configured n8n workflow.' : 'n8n webhook endpoint rejected the connection.' }, { status: response.ok ? 200 : 502 })
  } catch (error) {
    console.error('[v0] n8n connection test failed', error)
    return NextResponse.json({ connected: false, error: safeIntegrationError(error, 'n8n connection failed.') }, { status: 502 })
  }
}

export async function PUT() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ sent: false, error: 'Authentication required.' }, { status: 401 })

  const configuration = getN8nConfiguration()
  if (!configuration.configured) return NextResponse.json({ sent: false, error: 'n8n webhook configuration is missing.' }, { status: 503 })

  try {
    const response = await fetch(configuration.webhookUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source: 'techunified', event: 'integration_test', timestamp: new Date().toISOString(), environment: process.env.VERCEL_ENV || 'production' }), signal: AbortSignal.timeout(10000), cache: 'no-store' })
    if (!response.ok) return NextResponse.json({ sent: false, error: 'n8n rejected the test event.' }, { status: 502 })
    return NextResponse.json({ sent: true })
  } catch (error) {
    console.error('[v0] n8n webhook test failed', error)
    return NextResponse.json({ sent: false, error: safeIntegrationError(error, 'n8n test event failed.') }, { status: 502 })
  }
}
