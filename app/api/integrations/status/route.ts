import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { integrations } from '@/lib/integrations/registry'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in to view integration status.' }, { status: 401 })

  const available = Object.fromEntries(integrations.flatMap((provider) => provider.envKeys.map((key) => [key, Boolean(process.env[key])])))
  available.supabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  return NextResponse.json({ available })
}
