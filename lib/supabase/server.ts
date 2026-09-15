import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { requireSupabasePublicConfig } from './config'

export async function createClient() {
  const { url: supabaseUrl, key: supabaseKey } = requireSupabasePublicConfig()
  const cookieStore = await cookies()
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Server Components cannot always mutate cookies; proxy handles refresh persistence.
        }
      },
    },
  })
}
