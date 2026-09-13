import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getN8nConfiguration, safeIntegrationError } from '@/lib/integrations/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ sent: false, error: 'Authentication required.' }, { status: 401 })

  const configuration = getN8nConfiguration()
  if (!configuration.valid) return NextResponse.json({ sent: false, error: 'n8n URL configuration is invalid.' }, { status: 400 })
  if (!configuration.configured) return NextResponse.json({ sent: false, error: 'N8N_WEBHOOK_URL and N8N_WEBHOOK_SECRET are required.' }, { status: 503 })

  try {
    const response = await fetch(configuration.webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-TechUnified-Webhook-Secret': configuration.secret },
      body: JSON.stringify({ source: 'techunified-ai-os', event: 'integration.test', timestamp: new Date().toISOString(), message: 'TechUnified AI OS n8n integration test' }),
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    })
    if (!response.ok) return NextResponse.json({ sent: false, status: response.status, error: response.status === 401 || response.status === 403 ? 'n8n rejected the webhook authentication.' : 'n8n rejected the test event.' }, { status: 502 })
    return NextResponse.json({ sent: true, status: response.status })
  } catch (error) {
    console.error('[v0] n8n test event failed', error)
    return NextResponse.json({ sent: false, error: safeIntegrationError(error, 'n8n test event failed.') }, { status: 502 })
  }
}
