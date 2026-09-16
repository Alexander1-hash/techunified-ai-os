'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui'
import { FormFeedback, SettingsLoading, SettingsShell } from '@/components/settings/settings-shell'
import { useAuth } from '@/components/auth-provider'
import { resolveAvatarUrl, resolveDisplayName, resolveInitials } from '@/lib/identity'

export default function ProfileSettingsPage() {
  const { profile, user, loading } = useAuth()
  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (loading) return
    setFullName(resolveDisplayName(profile as never, user as never))
    setAvatarUrl(resolveAvatarUrl(profile as never, user as never))
  }, [loading, profile, user])

  if (loading) {
    return (
      <SettingsShell title="Profile" description="Update your name and avatar.">
        <SettingsLoading />
      </SettingsShell>
    )
  }

  const initials = resolveInitials(fullName || 'U')

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setStatus('saving')
    setMessage('')
    try {
      const response = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, avatar_url: avatarUrl }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Could not save your profile.')
      setStatus('success')
      setMessage('Profile updated.')
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Could not save your profile.')
    }
  }

  return (
    <SettingsShell title="Profile" description="Update your name and avatar. Only you can edit your own profile.">
      <Card>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl || '/placeholder.svg'} alt="Your avatar" className="size-16 rounded-full object-cover" />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">{initials}</div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium">{fullName || 'Your name'}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email ?? ''}</p>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="full_name" className="text-sm font-medium">Full name</label>
            <input
              id="full_name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              maxLength={120}
              required
              className="min-h-11 w-full rounded-lg border bg-muted/40 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="avatar_url" className="text-sm font-medium">Avatar URL <span className="text-muted-foreground">(optional)</span></label>
            <input
              id="avatar_url"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              placeholder="https://…"
              inputMode="url"
              className="min-h-11 w-full rounded-lg border bg-muted/40 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <p className="text-xs text-muted-foreground">Paste a public image URL. Leave blank to use your initials.</p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={status === 'saving'}
              className="min-h-11 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground disabled:cursor-wait disabled:opacity-60"
            >
              {status === 'saving' ? 'Saving…' : 'Save changes'}
            </button>
            <FormFeedback status={status} message={message} />
          </div>
        </form>
      </Card>
    </SettingsShell>
  )
}
