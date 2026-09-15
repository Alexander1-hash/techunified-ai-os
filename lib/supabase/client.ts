import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | undefined

export function createClient() {
  if (!browserClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase public URL and anon key are required.')
    }

    browserClient = createBrowserClient(supabaseUrl, supabaseKey)
  }
  return browserClient
}
