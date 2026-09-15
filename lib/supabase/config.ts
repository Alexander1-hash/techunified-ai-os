const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const publicSupabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

export function getSupabasePublicConfig() {
  return {
    url: publicSupabaseUrl,
    key: publicSupabaseKey,
  }
}

export function requireSupabasePublicConfig() {
  const { url, key } = getSupabasePublicConfig()

  if (!url || !key) {
    throw new Error('Supabase public URL and anon key are required.')
  }

  return { url, key }
}
