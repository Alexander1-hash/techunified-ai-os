import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  if (!code) return NextResponse.redirect(new URL('/login?error=missing_code', request.url))

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('[auth] callback exchange failed:', error.message)
    return NextResponse.redirect(new URL('/login?error=auth_callback_failed', request.url))
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login?error=session_missing', request.url))
  return NextResponse.redirect(new URL('/dashboard', request.url))
}

export const dynamic = 'force-dynamic'
