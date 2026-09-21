'use client'

import { useState } from 'react'
import { Loader2, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
import { BusinessAnalystWorkspace } from '@/components/business-analyst-workspace'

export default function AnalystPage() {
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function syncSalesIntelligence() {
    try {
      setSyncing(true)
      setMessage('')
      setError('')

      const response = await fetch(
        '/api/business/sales-intelligence',
        {
          method: 'POST',
        },
      )

      const json = await response.json()

      if (!response.ok) {
        throw new Error(
          json.error ||
            'Unable to synchronize sales intelligence.',
        )
      }

      setMessage(
        'Sales intelligence synchronized successfully. Business KPIs have been updated.',
      )

      window.setTimeout(() => {
        window.location.reload()
      }, 900)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to synchronize sales intelligence.',
      )
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/70 bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">
              Intelligence Sync
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Connect operational Sales and Customer activity to verified Business KPIs.
            </p>
          </div>

          <button
            type="button"
            onClick={syncSalesIntelligence}
            disabled={syncing}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {syncing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}

            {syncing
              ? 'Synchronizing…'
              : 'Sync Sales Intelligence'}
          </button>
        </div>

        {(message || error) && (
          <div className="mx-auto max-w-7xl px-5 pb-4">
            {message ? (
              <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                <CheckCircle2
                  size={16}
                  className="mt-0.5 shrink-0"
                />
                <span>{message}</span>
              </div>
            ) : null}

            {error ? (
              <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                <AlertCircle
                  size={16}
                  className="mt-0.5 shrink-0"
                />
                <span>{error}</span>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <BusinessAnalystWorkspace />
    </div>
  )
}
