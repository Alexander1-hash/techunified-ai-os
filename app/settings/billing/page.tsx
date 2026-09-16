'use client'

import useSWR from 'swr'
import { Card } from '@/components/ui'
import { SettingsError, SettingsLoading, SettingsShell } from '@/components/settings/settings-shell'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'

async function orgFetcher(orgId: string): Promise<Record<string, unknown> | null> {
  const supabase = createClient()
  const { data, error } = await supabase.from('organizations').select('*').eq('id', orgId).maybeSingle()
  if (error) throw new Error(error.message)
  return data as Record<string, unknown> | null
}

export default function BillingSettingsPage() {
  const { profile, loading } = useAuth()
  const orgId = (profile as { organization_id?: string | null } | null)?.organization_id ?? null
  const { data, error, isLoading } = useSWR(orgId ? ['billing-org', orgId] : null, () => orgFetcher(orgId as string))

  const shellProps = { title: 'Billing', description: 'Your organization plan and billing status.' }

  if (loading || isLoading) return <SettingsShell {...shellProps}><SettingsLoading /></SettingsShell>
  if (!orgId) return <SettingsShell {...shellProps}><SettingsError message="You do not belong to an organization yet." /></SettingsShell>
  if (error) return <SettingsShell {...shellProps}><SettingsError message={error.message} /></SettingsShell>

  const planValue = typeof data?.plan === 'string' && data.plan.trim() ? data.plan.trim() : null

  return (
    <SettingsShell {...shellProps}>
      <Card>
        <h2 className="font-medium">Current plan</h2>
        {planValue ? (
          <p className="mt-3 text-2xl font-semibold tracking-tight">{planValue}</p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No plan is configured for this organization yet.</p>
        )}
      </Card>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <h2 className="font-medium">Billing not connected</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          TechUnified AI OS does not have a billing provider connected yet. There are no invoices, payment methods, or usage charges to display. When billing is enabled, plan management and payment details will appear here.
        </p>
      </Card>
    </SettingsShell>
  )
}
