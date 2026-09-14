import { NextResponse } from 'next/server'
const EXPECTED_HOSTNAME = 'cqxudowdhlnqnmavmlve.supabase.co'

type KeyType = 'legacy_anon' | 'publishable' | 'unknown'

function classifyKey(key: string | undefined): KeyType {
  if (!key) return 'unknown'
  if (key.startsWith('sb_publishable_')) return 'publishable'
  if (key.split('.').length === 3) return 'legacy_anon'
  return 'unknown'
}

function safeErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return 'Supabase connectivity check failed.'
  const message = error.message.replace(/\s+/g, ' ').trim()
  return message ? message.slice(0, 200) : 'Supabase connectivity check failed.'
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const selectedKey = anonKey ?? publishableKey
  const selectedKeyVariable = anonKey !== undefined
    ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
    : publishableKey !== undefined
      ? 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
      : null

  const url = supabaseUrl ? (() => {
    try {
      return new URL(supabaseUrl)
    } catch {
      return null
    }
  })() : null

  const diagnostic = {
    temporary: true,
    supabaseUrlPresent: Boolean(supabaseUrl),
    supabaseHostnameMatches: url?.protocol === 'https:' && url.hostname === EXPECTED_HOSTNAME,
    anonKeyPresent: Boolean(anonKey),
    publishableKeyPresent: Boolean(publishableKey),
    selectedKeyVariable,
    selectedKeyType: classifyKey(selectedKey),
    supabaseConnectivity: 'failed' as 'success' | 'failed',
    status: null as number | null,
    errorCode: null as string | null,
    errorMessage: null as string | null,
  }

  if (!url || url.protocol !== 'https:' || url.hostname !== EXPECTED_HOSTNAME || !selectedKey) {
    diagnostic.errorMessage = 'Supabase URL or selected public key is missing or invalid.'
    return NextResponse.json(diagnostic)
  }

  try {
    const response = await fetch(`${url.origin}/auth/v1/health`, {
      headers: { apikey: selectedKey },
      cache: 'no-store',
    })
    diagnostic.status = response.status
    if (response.ok) {
      diagnostic.supabaseConnectivity = 'success'
    } else {
      const body = await response.json().catch(() => null)
      diagnostic.errorCode = typeof body?.code === 'string' ? body.code.slice(0, 100) : null
      diagnostic.errorMessage = typeof body?.message === 'string' ? body.message.slice(0, 200) : 'Supabase connectivity check failed.'
    }
  } catch (error) {
    diagnostic.errorMessage = safeErrorMessage(error)
  }

  return NextResponse.json(diagnostic)
}
