import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { getOpenAIConfiguration, safeIntegrationError } from '@/lib/integrations/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ connected: false, error: 'Authentication required.' }, { status: 401 })

  const configuration = getOpenAIConfiguration()
  if (!configuration.configured) return NextResponse.json({ connected: false, error: 'OpenAI configuration is missing.' }, { status: 503 })

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    await client.models.list()
    return NextResponse.json({ connected: true, model: configuration.model })
  } catch (error) {
    console.error('[v0] OpenAI connection test failed', error)
    return NextResponse.json({ connected: false, error: safeIntegrationError(error, 'OpenAI connection failed.') }, { status: 502 })
  }
}
