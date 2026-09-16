'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui'
import { SettingsShell } from '@/components/settings/settings-shell'
import { integrations } from '@/lib/integrations/registry'

export default function IntegrationsSettingsPage() {
  const categories = Array.from(new Set(integrations.map((provider) => provider.category)))

  return (
    <SettingsShell title="Integrations" description="Connect the tools your company already uses. Live connection status is managed in the Integration Center.">
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-medium">Integration Center</h2>
            <p className="mt-1 text-sm text-muted-foreground">Every status reflects real server configuration, not a placeholder claim.</p>
          </div>
          <Link href="/integrations" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90">
            Open Integration Center <ArrowRight size={15} />
          </Link>
        </div>
      </Card>

      <Card>
        <h2 className="font-medium">Available providers</h2>
        <p className="mt-1 text-sm text-muted-foreground">{integrations.length} providers across {categories.length} categories. Open a provider in the Integration Center to configure it.</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {integrations.map((provider) => (
            <li key={provider.id}>
              <Link href={`/integrations/${provider.id}`} className="flex min-h-11 items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2 text-sm transition hover:border-primary/40">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{provider.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{provider.category}</span>
                </span>
                <ArrowRight size={14} className="shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </SettingsShell>
  )
}
