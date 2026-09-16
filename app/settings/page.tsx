'use client'

import Link from 'next/link'
import { ArrowRight, Bell, Bot, Building2, CreditCard, Plug, ShieldCheck, User, Users } from 'lucide-react'
import { Card, PageHeader } from '@/components/ui'

const sections = [
  { href: '/settings/profile', label: 'Profile', description: 'Your name and avatar.', icon: User },
  { href: '/settings/organization', label: 'Organization', description: 'Company name, industry, website, and timezone.', icon: Building2 },
  { href: '/settings/security', label: 'Security', description: 'Email, password, and session actions.', icon: ShieldCheck },
  { href: '/settings/ai-preferences', label: 'AI Preferences', description: 'Default model, response style, and temperature.', icon: Bot },
  { href: '/settings/notifications', label: 'Notifications', description: 'Choose which alerts you receive.', icon: Bell },
  { href: '/settings/integrations', label: 'Integrations', description: 'Connect the tools your company already uses.', icon: Plug },
  { href: '/settings/billing', label: 'Billing', description: 'Your current plan.', icon: CreditCard },
  { href: '/settings/permissions', label: 'Permissions', description: 'Your role and what it can do.', icon: Users },
]

export default function SettingsPage() {
  return (
    <>
      <PageHeader eyebrow="System" title="Settings" subtitle="Configure your organization, profile, security, and AI preferences." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon
          return (
            <Link
              key={section.href}
              href={section.href}
              className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Card className="flex h-full flex-col transition group-hover:-translate-y-0.5 group-hover:border-primary/40">
                <div className="flex items-start justify-between">
                  <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                    <Icon size={19} />
                  </div>
                  <ArrowRight size={16} className="text-muted-foreground transition group-hover:text-primary" />
                </div>
                <h2 className="mt-5 font-medium">{section.label}</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{section.description}</p>
              </Card>
            </Link>
          )
        })}
      </div>
    </>
  )
}
