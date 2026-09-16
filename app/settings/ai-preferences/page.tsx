'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Card } from '@/components/ui'
import { FormFeedback, SettingsError, SettingsLoading, SettingsShell } from '@/components/settings/settings-shell'
import { modelTypes } from '@/lib/data'

const RESPONSE_STYLES = [
  { value: 'concise', label: 'Concise' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'detailed', label: 'Detailed' },
]

const DEFAULTS = { default_model: modelTypes[0], response_style: 'balanced', default_temperature: 0.7 }

type Prefs = { default_model: string | null; response_style: string | null; default_temperature: number | null }

const fetcher = async (url: string) => {
  const response = await fetch(url)
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const err = new Error(result.error || 'Could not load AI preferences.') as Error & { notReady?: boolean }
    err.notReady = Boolean(result.notReady)
    throw err
  }
  return result.preferences as Prefs | null
}

export default function AIPreferencesPage() {
  const { data, error, isLoading, mutate } = useSWR('/api/settings/ai-preferences', fetcher)
  const [model, setModel] = useState(DEFAULTS.default_model)
  const [style, setStyle] = useState(DEFAULTS.response_style)
  const [temperature, setTemperature] = useState(DEFAULTS.default_temperature)
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (data === undefined) return
    setModel(data?.default_model ?? DEFAULTS.default_model)
    setStyle(data?.response_style ?? DEFAULTS.response_style)
    setTemperature(data?.default_temperature ?? DEFAULTS.default_temperature)
  }, [data])

  const shellProps = { title: 'AI Preferences', description: 'Set the defaults used when you start new AI conversations and generations.' }

  if (isLoading) return <SettingsShell {...shellProps}><SettingsLoading /></SettingsShell>
  if (error) {
    const notReady = (error as Error & { notReady?: boolean }).notReady
    return (
      <SettingsShell {...shellProps}>
        <SettingsError message={notReady ? 'AI preferences storage is not set up yet. Run the settings_foundation migration in Supabase, then reload this page.' : error.message} />
      </SettingsShell>
    )
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setStatus('saving')
    setMessage('')
    try {
      const response = await fetch('/api/settings/ai-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_model: model, response_style: style, default_temperature: temperature }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Could not save AI preferences.')
      await mutate()
      setStatus('success')
      setMessage('AI preferences saved.')
    } catch (saveError) {
      setStatus('error')
      setMessage(saveError instanceof Error ? saveError.message : 'Could not save AI preferences.')
    }
  }

  return (
    <SettingsShell {...shellProps}>
      {!data && (
        <Card className="border-primary/20 bg-primary/5">
          <p className="text-sm text-muted-foreground">You have not saved any preferences yet. The values below are sensible defaults until you save your own.</p>
        </Card>
      )}
      <Card>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="ai-model" className="text-sm font-medium">Default model</label>
            <select id="ai-model" value={model} onChange={(e) => setModel(e.target.value)} className="min-h-11 w-full rounded-lg border bg-muted/40 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary">
              {modelTypes.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="ai-style" className="text-sm font-medium">Response style</label>
            <select id="ai-style" value={style} onChange={(e) => setStyle(e.target.value)} className="min-h-11 w-full rounded-lg border bg-muted/40 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary">
              {RESPONSE_STYLES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="ai-temperature" className="text-sm font-medium">Default temperature</label>
              <span className="text-sm text-muted-foreground">{temperature.toFixed(1)}</span>
            </div>
            <input id="ai-temperature" type="range" min={0} max={2} step={0.1} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} className="w-full accent-primary" />
            <p className="text-xs text-muted-foreground">Lower values are more focused and deterministic; higher values are more creative.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" disabled={status === 'saving'} className="min-h-11 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground disabled:cursor-wait disabled:opacity-60">{status === 'saving' ? 'Saving…' : 'Save preferences'}</button>
            <FormFeedback status={status} message={message} />
          </div>
        </form>
      </Card>
    </SettingsShell>
  )
}
