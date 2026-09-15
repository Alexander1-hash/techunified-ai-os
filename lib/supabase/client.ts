import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireSupabasePublicConfig } from './config'

let browserClient: SupabaseClient | undefined

export function createClient() {
  if (!browserClient) {
    const { url: supabaseUrl, key: supabaseKey } = requireSupabasePublicConfig()

    browserClient = createBrowserClient(supabaseUrl, supabaseKey)
  }
  return browserClient
}
