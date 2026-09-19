'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, CircleAlert } from 'lucide-react'

function Panel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5">
      <h2 className="font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 text-sm leading-6 text-muted-foreground">
        {children}
      </div>
    </section>
  )
}

export function BusinessAnalystInspector() {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/business/inspector')
      .then(async (response) => {
        const json = await response.json()

        if (!response.ok) {
          throw new Error(
            json.error || 'Unable to load inspection data.'
          )
        }

        setData(json)
      })
      .catch((err) => {
        setError(
          err.message || 'Unable to load inspection data.'
        )
      })
  }, [])

  if (error) {
    return (
      <main className="min-h-screen bg-background px-5 py-8">
        <div className="mx-auto max-w-7xl">
          <Panel title="Unable to load Inspector">
            {error}
          </Panel>
        </div>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-background px-5 py-8">
        <div className="mx-auto max-w-7xl">
          <Panel title="Loading Inspector">
            Inspecting verified business evidence…
          </Panel>
        </div>
      </main>
    )
  }

  const inspected = data.inspected ?? []
  const summary = data.summary ?? {}

  return (
    <main className="min-h-screen bg-background px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">
            Business Analyst · Inspector
          </p>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
            Inspect the evidence behind your business.
          </h1>

          <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
            Inspector checks organization-scoped KPI records for changes,
            warnings, missing source information, and other evidence that
            deserves attention.
          </p>
        </header>

        {!inspected.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="No evidence available">
              {data.message ||
                'No verified KPI records are available for inspection yet.'}
            </Panel>

            <Panel title="Next best action">
              <Link
                href="/brain/data-sources"
                className="inline-flex items-center gap-2 text-primary"
              >
                Connect a verified data source
                <ArrowRight size={15} />
              </Link>
            </Panel>
          </div>
        ) : (
          <>
            <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Panel title="Records inspected">
                <strong className="text-3xl text-foreground">
                  {summary.total}
                </strong>
                <p>Organization KPI records inspected.</p>
              </Panel>

              <Panel title="Verified">
                <strong className="text-3xl text-foreground">
                  {summary.verified}
                </strong>
                <p>Records with no detected inspection issues.</p>
              </Panel>

              <Panel title="Needs attention">
                <strong className="text-3xl text-foreground">
                  {summary.attention}
                </strong>
                <p>Records requiring closer review.</p>
              </Panel>

              <Panel title="Inspection coverage">
                <strong className="text-3xl text-foreground">
                  {summary.coverage}%
                </strong>
                <p>Records currently passing inspection.</p>
              </Panel>
            </div>

            <Panel title="Inspection results">
              <div className="space-y-3">
                {inspected.map((item: any) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-border/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        {item.inspectionStatus === 'attention' ? (
                          <CircleAlert
                            size={20}
                            className="mt-0.5 shrink-0"
                          />
                        ) : (
                          <CheckCircle2
                            size={20}
                            className="mt-0.5 shrink-0"
                          />
                        )}

                        <div>
                          <p className="font-medium text-foreground">
                            {item.name}
                          </p>

                          <p className="text-xs">
                            {item.source || 'Source not identified'} ·{' '}
                            {item.period || 'Recorded period'}
                          </p>
                        </div>
                      </div>

                      <span className="rounded-full border px-2.5 py-1 text-xs capitalize">
                        {item.inspectionStatus}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div>
                        <p className="text-xs">Current</p>
                        <strong className="text-foreground">
                          {item.current ?? '—'} {item.unit || ''}
                        </strong>
                      </div>

                      <div>
                        <p className="text-xs">Previous</p>
                        <strong className="text-foreground">
                          {item.previous ?? '—'} {item.unit || ''}
                        </strong>
                      </div>

                      <div>
                        <p className="text-xs">Change</p>
                        <strong className="text-foreground">
                          {item.changePercent === null
                            ? '—'
                            : `${item.changePercent}%`}
                        </strong>
                      </div>

                      <div>
                        <p className="text-xs">Trend</p>
                        <strong className="capitalize text-foreground">
                          {item.trend || 'Unknown'}
                        </strong>
                      </div>
                    </div>

                    {item.issues?.length > 0 && (
                      <div className="mt-4 rounded-lg border border-border/60 p-3">
                        <p className="font-medium text-foreground">
                          Inspection findings
                        </p>

                        <ul className="mt-2 space-y-1">
                          {item.issues.map((issue: string) => (
                            <li key={issue}>• {issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          </>
        )}
      </div>
    </main>
  )
    }
