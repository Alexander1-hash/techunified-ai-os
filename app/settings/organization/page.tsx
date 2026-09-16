'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Card } from '@/components/ui'
import { FormFeedback, SettingsError, SettingsLoading, SettingsShell } from '@/components/settings/settings-shell'
import { useAuth } from '@/components/auth-provider'
import { canManageOrganization, type Role } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/client'

type OrgRecord = { id: string; name?: string | null; description?: string | null; industry?: string | null; website?: string | null; timezone?: string | null }

async function orgFetcher(orgId: string): Promise<OrgRecord | null> {
  const supabase = createClient()
  const { data, error } = await supabase.from('organizations').select('*').eq('id', orgId).maybeSingle()
  if (error) throw new Error(error.message)
  return data as OrgRecord | null
}

export default function OrganizationSettingsPage() {
  const { profile, role, loading } = useAuth()
  const orgId = (profile as { organization_id?: string | null } | null)?.organization_id ?? null
  const canManage = canManageOrganization(role as Role)
  const { data, error, isLoading, mutate } = useSWR(orgId ? ['organization', orgId] : null, () => orgFetcher(orgId as string))

  const [form, setForm] = useState({ name: '', description: '', industry: '', website: '', timezone: '' })
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!data) return
    setForm({
      name: data.name ?? '',
      description: data.description ?? '',
      industry: data.industry ?? '',
      website: data.website ?? '',
      timezone: data.timezone ?? '',
    })
  }, [data])

  const shellProps = { title: 'Organization', description: 'Manage your company profile. Changes apply to everyone in your organization.' }

  if (loading || isLoading) return <SettingsShell {...shellProps}><SettingsLoading /></SettingsShell>
  if (!orgId) return <SettingsShell {...shellProps}><SettingsError message="You do not belong to an organization yet." /></SettingsShell>
  if (error) return <SettingsShell {...shellProps}><SettingsError message={error.message} /></SettingsShell>

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setStatus('saving')
    setMessage('')
    try {
      const response = await fetch('/api/settings/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Could not save organization settings.')
      await mutate()
      setStatus('success')
      setMessage('Organization settings updated.')
    } catch (saveError) {
      setStatus('error')
      setMessage(saveError instanceof Error ? saveError.message : 'Could not save organization settings.')
    }
  }

  const field = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <SettingsShell {...shellProps}>
      {!canManage && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <p className="text-sm text-muted-foreground">Your current role ({role}) can view these settings but cannot edit them. An Admin or Owner can make changes.</p>
        </Card>
      )}
      <Card>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="org-name" className="text-sm font-medium">Company name</label>
            <input id="org-name" value={form.name} onChange={(e) => field('name', e.target.value)} disabled={!canManage} maxLength={120} required className="min-h-11 w-full rounded-lg border bg-muted/40 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60" />
          </div>
          <div className="space-y-2">
            <label htmlFor="org-description" className="text-sm font-medium">Description</label>
            <textarea id="org-description" value={form.description} onChange={(e) => field('description', e.target.value)} disabled={!canManage} maxLength={500} rows={3} className="w-full resize-y rounded-lg border bg-muted/40 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="org-industry" className="text-sm font-medium">Industry</label>
              <input id="org-industry" value={form.industry} onChange={(e) => field('industry', e.target.value)} disabled={!canManage} maxLength={120} className="min-h-11 w-full rounded-lg border bg-muted/40 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60" />
            </div>
            <div className="space-y-2">
              <label htmlFor="org-timezone" className="text-sm font-medium">Timezone</label>
              <input id="org-timezone" value={form.timezone} onChange={(e) => field('timezone', e.target.value)} disabled={!canManage} maxLength={100} placeholder="Africa/Lagos" className="min-h-11 w-full rounded-lg border bg-muted/40 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60" />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="org-website" className="text-sm font-medium">Website</label>
            <input id="org-website" value={form.website} onChange={(e) => field('website', e.target.value)} disabled={!canManage} inputMode="url" placeholder="https://…" className="min-h-11 w-full rounded-lg border bg-muted/40 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60" />
          </div>
          {canManage && (
            <div className="flex flex-wrap items-center gap-4">
              <button type="submit" disabled={status === 'saving'} className="min-h-11 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground disabled:cursor-wait disabled:opacity-60">{status === 'saving' ? 'Saving…' : 'Save changes'}</button>
              <FormFeedback status={status} message={message} />
            </div>
          )}
        </form>
      </Card>
    </SettingsShell>
  )
}
