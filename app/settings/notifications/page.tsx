'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Card } from '@/components/ui'
import { FormFeedback, SettingsError, SettingsLoading, SettingsShell } from '@/components/settings/settings-shell'

type Prefs = { email_enabled: boolean; product_updates: boolean; workflow_alerts: boolean; security_alerts: boolean }

const DEFAULTS: Prefs = { email_enabled: true, product_updates: true, workflow_alerts: true, security_alerts: true }

const OPTIONS: { key: keyof Prefs; label: string; description: string }[] = [
  { key: 'email_enabled', label: 'Email notifications', description: 'Receive account and activity emails.' },
  { key: 'product_updates', label: 'Product updates', description: 'News about new features and improvements.' },
  { key: 'workflow_alerts', label: 'Workflow alerts', description: 'Updates when automations run or need attention.' },
  { key: 'security_alerts', label: 'Security alerts', description: 'Important notices about your account security.' },
]

const fetcher = async (url: string) => {
  const response = await fetch(url)
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const err = new Error(result.error || 'Could not load notification preferences.') as Error & { notReady?: boolean }
    err.notReady = Boolean(result.notReady)
    throw err
  }
  return result.preferences as Prefs | null
}

export default function NotificationsSettingsPage() {
  const { data, error, isLoading, mutate } = useSWR('/api/settings/notifications', fetcher)
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS)
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (data === undefined) return
    setPrefs(data ?? DEFAULTS)
  }, [data])

  const shellProps = { title: 'Notifications', description: 'Choose which notifications you want to receive. Delivery starts once each channel is connected.' }

  if (isLoading) return <SettingsShell {...shellProps}><SettingsLoading /></SettingsShell>
  if (error) {
    const notReady = (error as Error & { notReady?: boolean }).notReady
    return (
      <SettingsShell {...shellProps}>
        <SettingsError message={notReady ? 'Notification preferences storage is not set up yet. Run the settings_foundation migration in Supabase, then reload this page.' : error.message} />
      </SettingsShell>
    )
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setStatus('saving')
    setMessage('')
    try {
      const response = await fetch('/api/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Could not save notification preferences.')
      await mutate()
      setStatus('success')
      setMessage('Notification preferences saved.')
    } catch (saveError) {
      setStatus('error')
      setMessage(saveError instanceof Error ? saveError.message : 'Could not save notification preferences.')
    }
  }

  return (
    <SettingsShell {...shellProps}>
      <Card className="border-primary/20 bg-primary/5">
        <p className="text-sm text-muted-foreground">These are your delivery preferences. TechUnified stores them now; individual channels send notifications as they become available.</p>
      </Card>
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          {OPTIONS.map((option) => (
            <label key={option.key} htmlFor={option.key} className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border bg-muted/20 p-4">
              <span className="min-w-0">
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span>
              </span>
              <input
                id={option.key}
                type="checkbox"
                checked={prefs[option.key]}
                onChange={(e) => setPrefs((prev) => ({ ...prev, [option.key]: e.target.checked }))}
                className="mt-0.5 size-5 shrink-0 accent-primary"
              />
            </label>
          ))}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button type="submit" disabled={status === 'saving'} className="min-h-11 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground disabled:cursor-wait disabled:opacity-60">{status === 'saving' ? 'Saving…' : 'Save preferences'}</button>
            <FormFeedback status={status} message={message} />
          </div>
        </form>
      </Card>
    </SettingsShell>
  )
}
