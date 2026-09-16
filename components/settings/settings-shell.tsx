'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui'

export function SettingsShell({
  eyebrow = 'Settings',
  title,
  description,
  children,
}: {
  eyebrow?: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Link
        href="/settings"
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ArrowLeft size={15} /> Back to Settings
      </Link>
      <header className="min-w-0">
        <div className="mb-2 text-xs font-medium uppercase tracking-[.18em] text-primary">{eyebrow}</div>
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      </header>
      {children}
    </div>
  )
}

export function SettingsLoading() {
  return (
    <Card>
      <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">Loading…</div>
    </Card>
  )
}

export function SettingsError({ message }: { message: string }) {
  return (
    <Card className="border-destructive/30">
      <div className="flex min-h-24 flex-col items-center justify-center gap-2 text-center">
        <h2 className="font-medium">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </Card>
  )
}

export function FormFeedback({ status, message }: { status: 'idle' | 'saving' | 'success' | 'error'; message: string }) {
  if (status === 'success') return <p role="status" className="text-sm text-primary">{message || 'Saved.'}</p>
  if (status === 'error') return <p role="alert" className="text-sm text-destructive">{message || 'Could not save changes.'}</p>
  return null
}
