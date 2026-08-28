import type { SupabaseClient } from '@supabase/supabase-js'

export type Profile = { id: string; full_name: string | null; avatar_url: string | null; created_at: string | null }

export async function getCurrentProfile(supabase: SupabaseClient) {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { profile: null, user: null, error: authError ?? new Error('Unauthorized') }
  const { data, error } = await supabase.from('profiles').select('id, full_name, avatar_url, created_at').eq('id', user.id).maybeSingle()
  if (error && error.code !== '42P01' && error.code !== 'PGRST205') return { profile: null, user, error }
  return { profile: data as Profile | null, user, error: null }
}

export async function updateCurrentProfile(supabase: SupabaseClient, values: Pick<Profile, 'full_name' | 'avatar_url'>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error('Unauthorized') }
  return supabase.from('profiles').update(values).eq('id', user.id).select('id, full_name, avatar_url, created_at').single()
}
