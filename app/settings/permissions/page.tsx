'use client'

import { Check, Minus } from 'lucide-react'
import { Card } from '@/components/ui'
import { SettingsLoading, SettingsShell } from '@/components/settings/settings-shell'
import { useAuth } from '@/components/auth-provider'
import {
  canCreateWorkflow,
  canManageAgents,
  canManageIntegrations,
  canManageOrganization,
  canUploadKnowledge,
  canViewAnalytics,
  type Role,
} from '@/lib/auth/permissions'

const CAPABILITIES: { label: string; check: (role?: Role) => boolean; minimum: Role }[] = [
  { label: 'View analytics', check: canViewAnalytics, minimum: 'Member' },
  { label: 'Upload knowledge documents', check: canUploadKnowledge, minimum: 'Member' },
  { label: 'Manage AI agents', check: canManageAgents, minimum: 'Manager' },
  { label: 'Create workflows', check: canCreateWorkflow, minimum: 'Manager' },
  { label: 'Manage integrations', check: canManageIntegrations, minimum: 'Admin' },
  { label: 'Manage organization settings', check: canManageOrganization, minimum: 'Admin' },
]

export default function PermissionsSettingsPage() {
  const { role, loading } = useAuth()
  const shellProps = { title: 'Permissions', description: 'Your current role and what it can do across TechUnified AI OS.' }

  if (loading) return <SettingsShell {...shellProps}><SettingsLoading /></SettingsShell>

  const currentRole = role as Role

  return (
    <SettingsShell {...shellProps}>
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium">Your role</h2>
            <p className="mt-1 text-sm text-muted-foreground">Roles are assigned by your organization.</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">{currentRole}</span>
        </div>
      </Card>

      <Card>
        <h2 className="font-medium">Capabilities</h2>
        <p className="mt-1 text-sm text-muted-foreground">Based on your role. This view is read-only; role management is not available yet.</p>
        <ul className="mt-4 divide-y">
          {CAPABILITIES.map((capability) => {
            const allowed = capability.check(currentRole)
            return (
              <li key={capability.label} className="flex items-center justify-between gap-4 py-3">
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{capability.label}</span>
                  <span className="block text-xs text-muted-foreground">Requires {capability.minimum} or higher</span>
                </span>
                {allowed ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-primary"><Check size={16} /> Allowed</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Minus size={16} /> Not allowed</span>
                )}
              </li>
            )
          })}
        </ul>
      </Card>
    </SettingsShell>
  )
}
