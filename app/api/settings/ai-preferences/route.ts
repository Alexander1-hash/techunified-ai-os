import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MISSING_TABLE = new Set(['42P01', 'PGRST205'])
const RESPONSE_STYLES = ['concise', 'balanced', 'detailed']

function missingTableResponse() {
  return NextResponse.json(
    { error: 'AI preferences storage is not set up yet. Run the settings_foundation migration in Supabase to enable it.', notReady: true },
    { status: 503 },
  )
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in to continue.' }, { status: 401 })

  const { data, error } = await supabase
    .from('ai_preferences')
    .select('default_model, response_style, default_temperature')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    if (MISSING_TABLE.has(error.code)) return missingTableResponse()
    console.error('[settings/ai-preferences] read failed:', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'We could not load your AI preferences.' }, { status: 400 })
  }
  return NextResponse.json({ preferences: data })
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in to continue.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const defaultModel = typeof body?.default_model === 'string' ? body.default_model.trim() : ''
  const responseStyle = typeof body?.response_style === 'string' ? body.response_style.trim() : ''
  const temperatureRaw = body?.default_temperature

  if (defaultModel && defaultModel.length > 120) return NextResponse.json({ error: 'Choose a valid default model.' }, { status: 400 })
  if (responseStyle && !RESPONSE_STYLES.includes(responseStyle)) return NextResponse.json({ error: 'Choose a valid response style.' }, { status: 400 })

  let temperature: number | null = null
  if (temperatureRaw !== null && temperatureRaw !== undefined && temperatureRaw !== '') {
    const parsed = Number(temperatureRaw)
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 2) return NextResponse.json({ error: 'Temperature must be between 0 and 2.' }, { status: 400 })
    temperature = parsed
  }

  const { data, error } = await supabase
    .from('ai_preferences')
    .upsert(
      { user_id: user.id, default_model: defaultModel || null, response_style: responseStyle || null, default_temperature: temperature },
      { onConflict: 'user_id' },
    )
    .select('default_model, response_style, default_temperature')
    .single()

  if (error) {
    if (MISSING_TABLE.has(error.code)) return missingTableResponse()
    console.error('[settings/ai-preferences] save failed:', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'We could not save your AI preferences.' }, { status: 400 })
  }
  return NextResponse.json({ preferences: data })
}
