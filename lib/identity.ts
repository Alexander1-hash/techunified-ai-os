type ProfileLike = { full_name?: string | null; avatar_url?: string | null } | null | undefined
type UserLike = { email?: string | null; user_metadata?: { full_name?: string | null; name?: string | null; avatar_url?: string | null } } | null | undefined

export function resolveEmail(user: UserLike): string {
  return typeof user?.email === 'string' ? user.email : ''
}

export function resolveDisplayName(profile: ProfileLike, user: UserLike): string {
  const fromProfile = typeof profile?.full_name === 'string' ? profile.full_name.trim() : ''
  if (fromProfile) return fromProfile
  const fromMeta = user?.user_metadata?.full_name ?? user?.user_metadata?.name
  if (typeof fromMeta === 'string' && fromMeta.trim()) return fromMeta.trim()
  const email = resolveEmail(user)
  if (email.includes('@')) return email.split('@')[0]
  return 'Member'
}

export function resolveAvatarUrl(profile: ProfileLike, user: UserLike): string {
  const fromProfile = typeof profile?.avatar_url === 'string' ? profile.avatar_url.trim() : ''
  if (fromProfile) return fromProfile
  const fromMeta = user?.user_metadata?.avatar_url
  if (typeof fromMeta === 'string' && fromMeta.trim()) return fromMeta.trim()
  return ''
}

export function resolveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}
