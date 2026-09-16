'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { Card } from '@/components/ui'
import { FormFeedback, SettingsLoading, SettingsShell } from '@/components/settings/settings-shell'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'

export default function SecuritySettingsPage() {
  const { user, loading, signOut } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const shellProps = { title: 'Security', description: 'Manage how you sign in and keep your account secure.' }

  if (loading) return <SettingsShell {...shellProps}><SettingsLoading /></SettingsShell>

  const lastSignIn = user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : null

  const onChangePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    if (password.length < 8) {
      setStatus('error')
      setMessage('Use at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setStatus('error')
      setMessage('Passwords do not match.')
      return
    }
    setStatus('saving')
    setMessage('')
    const { error } = await createClient().auth.updateUser({ password })
    if (error) {
      setStatus('error')
      setMessage(error.message)
      return
    }
    setStatus('success')
    setMessage('Password updated.')
    setPassword('')
    setConfirm('')
  }

  return (
    <SettingsShell {...shellProps}>
      <Card>
        <h2 className="font-medium">Account</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Signed in as</dt>
            <dd className="mt-1 truncate font-medium">{user?.email ?? 'Unknown'}</dd>
          </div>
          {lastSignIn && (
            <div>
              <dt className="text-muted-foreground">Last sign in</dt>
              <dd className="mt-1 font-medium">{lastSignIn}</dd>
            </div>
          )}
        </dl>
      </Card>

      <Card>
        <h2 className="font-medium">Change password</h2>
        <p className="mt-1 text-sm text-muted-foreground">Set a new password for your account.</p>
        <form onSubmit={onChangePassword} className="mt-5 space-y-4">
          <div className="space-y-2">
            <label htmlFor="new-password" className="text-sm font-medium">New password</label>
            <input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required className="min-h-11 w-full rounded-lg border bg-muted/40 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary" />
          </div>
          <div className="space-y-2">
            <label htmlFor="confirm-password" className="text-sm font-medium">Confirm password</label>
            <input id="confirm-password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" minLength={8} required className="min-h-11 w-full rounded-lg border bg-muted/40 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary" />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" disabled={status === 'saving'} className="min-h-11 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground disabled:cursor-wait disabled:opacity-60">{status === 'saving' ? 'Updating…' : 'Update password'}</button>
            <FormFeedback status={status} message={message} />
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-medium">Session</h2>
            <p className="mt-1 text-sm text-muted-foreground">Sign out of this device.</p>
          </div>
          <button type="button" onClick={() => void signOut()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-destructive/40 px-4 text-sm font-medium text-destructive transition hover:bg-destructive/10">
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </Card>
    </SettingsShell>
  )
}
