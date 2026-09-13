import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getN8nConfiguration, safeIntegrationError } from '@/lib/integrations/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ connected: false, error: 'Authentication required.' }, { status: 401 })

  const configuration = getN8nConfiguration()
  if (!configuration.valid) return NextResponse.json({ connected: false, error: 'n8n URL configuration is invalid.' }, { status: 400 })
  if (!configuration.configured) return NextResponse.json({ connected: false, error: 'N8N_WEBHOOK_URL and N8N_WEBHOOK_SECRET are required.' }, { status: 503 })
  if (!configuration.hasBaseUrl) return NextResponse.json({ connected: false, configured: true, status: 'webhook-configured', message: 'Webhook configured. A live workflow test verifies the active workflow.' }, { status: 200 })

  try {
    const response = await fetch(`${configuration.baseUrl}/healthz`, { method: 'GET', signal: AbortSignal.timeout(8000), cache: 'no-store' })
    if (response.ok) return NextResponse.json({ connected: true, configured: true, status: 'connected' })
    return NextResponse.json({ connected: false, configured: true, error: response.status === 401 || response.status === 403 ? 'n8n rejected the server configuration.' : 'n8n instance health check failed.' }, { status: 502 })
  } catch (error) {
    console.error('[v0] n8n connection test failed', error)
    return NextResponse.json({ connected: false, error: safeIntegrationError(error, 'n8n connection failed.') }, { status: 502 })
  }
}

