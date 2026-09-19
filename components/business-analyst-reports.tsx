'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react'

type KPI = {
  id: string
  name: string
  value: number | null
  previous_value?: number | null
  unit?: string | null
  period?: string | null
  trend?: string | null
  status?: string | null
  source?: string | null
  recorded_at?: string | null
}

type AnalystData = {
  kpis: KPI[]
  quality: number
  health: number | null
  areas: string[]
  recommendations: Array<{
    title: string
    problem: string
    recommended_action: string
    confidence: number
  }>
  nextAction: string
  sources: Array<{
    id: string
    name: string
    provider?: string | null
    status?: string | null
    last_synced_at?: string | null
  }>
}

function Panel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5">
      <h2 className="font-semibold tracking-tight text-foreground">
        {title}
      </h2>

      <div className="mt-3 text-sm leading-6 text-muted-foreground">
        {children}
      </div>
    </section>
  )
}

function formatValue(value: number | null | undefined, unit?: string | null) {
  if (value === null || value === undefined) return '—'

  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value)

  if (unit === 'percent') return `${formatted}%`
  if (unit === 'currency') return formatted

  return formatted
}

function calculateChange(
  current: number | null | undefined,
  previous: number | null | undefined
) {
  if (
    current === null ||
    current === undefined ||
    previous === null ||
    previous === undefined ||
    previous === 0
  ) {
    return null
  }

  return ((current - previous) / Math.abs(previous)) * 100
}

export function BusinessAnalystReports() {
  const [data, setData] = useState<AnalystData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function loadReport() {
    try {
      setLoading(true)
      setError('')

      const response = await fetch('/api/business/analysis', {
        cache: 'no-store',
      })

      const json = await response.json()

      if (!response.ok) {
        throw new Error(
          json.error || 'Unable to load the business report.'
        )
      }

      setData(json)
    } catch (err: any) {
      setError(
        err?.message || 'Unable to load the business report.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReport()
  }, [])

  if (loading) {
    return (
      <main className="min-h-screen bg-background px-5 py-8">
        <div className="mx-auto max-w-7xl">
          <Panel title="Loading business report">
            Reading verified organization KPI evidence…
          </Panel>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background px-5 py-8">
        <div className="mx-auto max-w-7xl">
          <Panel title="Unable to load report">
            <div className="flex flex-col gap-4">
              <p>{error}</p>

              <button
                type="button"
                onClick={loadReport}
                className="inline-flex w-fit items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                <RefreshCw size={15} />
                Try again
              </button>
            </div>
          </Panel>
        </div>
      </main>
    )
  }

  if (!data) {
    return null
  }

  const kpis = data.kpis ?? []
  const recommendations = data.recommendations ?? []
  const areas = data.areas ?? []

  const declining = kpis.filter((kpi) => {
    const change = calculateChange(
      kpi.value,
      kpi.previous_value
    )

    return change !== null && change < 0
  })

  const improving = kpis.filter((kpi) => {
    const change = calculateChange(
      kpi.value,
      kpi.previous_value
    )

    return change !== null && change > 0
  })

  return (
    <main className="min-h-screen bg-background px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">
                Business Analyst · Reports
              </p>

              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
                Business performance report.
              </h1>

              <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
                A current evidence-based view of your organization using
                confirmed KPI records and connected business data.
              </p>
            </div>

            <button
              type="button"
              onClick={loadReport}
              className="inline-flex w-fit items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              <RefreshCw size={15} />
              Refresh report
            </button>
          </div>
        </header>

        {!kpis.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Report needs more data">
              <div className="flex gap-3">
                <TriangleAlert className="mt-1 shrink-0" size={18} />

                <div>
                  <p>
                    There are currently no confirmed KPI records available
                    for this organization.
                  </p>

                  <Link
                    href="/brain/data-sources"
                    className="mt-4 inline-flex items-center gap-2 text-primary"
                  >
                    Connect a verified data source
                    <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
            </Panel>

            <Panel title="Next best action">
              {data.nextAction}
            </Panel>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Panel title="Business Health">
                <strong className="text-3xl text-foreground">
                  {data.health ?? '—'}
                </strong>

                <p>
                  Based on {kpis.length} confirmed KPI
                  {kpis.length === 1 ? '' : 's'}.
                </p>
              </Panel>

              <Panel title="Data Coverage">
                <strong className="text-3xl text-foreground">
                  {data.quality}%
                </strong>

                <p>
                  Verified KPI coverage across available records.
                </p>
              </Panel>

              <Panel title="Improving KPIs">
                <strong className="text-3xl text-foreground">
                  {improving.length}
                </strong>

                <p>
                  KPI records with a positive change from the previous value.
                </p>
              </Panel>

              <Panel title="Declining KPIs">
                <strong className="text-3xl text-foreground">
                  {declining.length}
                </strong>

                <p>
                  KPI records showing a negative change.
                </p>
              </Panel>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Panel title="KPI Performance">
                <div className="space-y-3">
                  {kpis.map((kpi) => {
                    const change = calculateChange(
                      kpi.value,
                      kpi.previous_value
                    )

                    return (
                      <div
                        key={kpi.id}
                        className="rounded-xl border border-border/60 p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium text-foreground">
                              {kpi.name}
                            </p>

                            <p className="text-xs">
                              {kpi.source || 'Verified source'}
                              {' · '}
                              {kpi.period || 'Recorded period'}
                            </p>
                          </div>

                          {kpi.status === 'verified' ? (
                            <CheckCircle2
                              size={18}
                              className="shrink-0"
                            />
                          ) : (
                            <TriangleAlert
                              size={18}
                              className="shrink-0"
                            />
                          )}
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs">
                              Current
                            </p>

                            <strong className="text-xl text-foreground">
                              {formatValue(kpi.value, kpi.unit)}
                            </strong>
                          </div>

                          <div>
                            <p className="text-xs">
                              Previous
                            </p>

                            <strong className="text-xl text-foreground">
                              {formatValue(
                                kpi.previous_value,
                                kpi.unit
                              )}
                            </strong>
                          </div>
                        </div>

                        <div className="mt-3 border-t border-border/60 pt-3">
                          <p className="text-xs">
                            Change:{' '}
                            <span className="font-medium text-foreground">
                              {change === null
                                ? 'Not available'
                                : `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`}
                            </span>
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Panel>

              <Panel title="Key Findings">
                {declining.length ? (
                  <div className="space-y-4">
                    {declining.map((kpi) => {
                      const change = calculateChange(
                        kpi.value,
                        kpi.previous_value
                      )

                      return (
                        <div
                          key={kpi.id}
                          className="rounded-xl border border-border/60 p-4"
                        >
                          <p className="font-medium text-foreground">
                            {kpi.name} changed
                          </p>

                          <p className="mt-1">
                            The latest recorded value is{' '}
                            <strong className="text-foreground">
                              {formatValue(kpi.value, kpi.unit)}
                            </strong>{' '}
                            compared with{' '}
                            <strong className="text-foreground">
                              {formatValue(
                                kpi.previous_value,
                                kpi.unit
                              )}
                            </strong>{' '}
                            previously.
                          </p>

                          {change !== null && (
                            <p className="mt-2 text-xs">
                              Recorded change: {change.toFixed(1)}%
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <BarChart3
                      size={18}
                      className="mt-1 shrink-0"
                    />

                    <p>
                      No declining KPI movement is currently supported by
                      the available verified records.
                    </p>
                  </div>
                )}
              </Panel>

              <Panel title="Evidence & Data Quality">
                <div className="space-y-3">
                  <p>
                    <strong className="text-foreground">
                      {data.quality}%
                    </strong>{' '}
                    of the currently available KPI records meet the
                    report&apos;s verified-data criteria.
                  </p>

                  <p>
                    The report uses organization-scoped KPI records from
                    connected business sources.
                  </p>

                  <p>
                    Recommendations are shown only where the available
                    evidence supports them.
                  </p>

                  <Link
                    href="/business-analyst/inspector"
                    className="inline-flex items-center gap-2 text-primary"
                  >
                    Open data inspector
                    <ArrowRight size={15} />
                  </Link>
                </div>
              </Panel>

              <Panel title="Recommended Actions">
                {recommendations.length ? (
                  <div className="space-y-4">
                    {recommendations.map((recommendation) => (
                      <div
                        key={recommendation.title}
                        className="rounded-xl border border-border/60 p-4"
                      >
                        <p className="font-medium text-foreground">
                          {recommendation.title}
                        </p>

                        <p className="mt-1">
                          {recommendation.problem}
                        </p>

                        <p className="mt-2 text-foreground">
                          {recommendation.recommended_action}
                        </p>

                        <p className="mt-2 text-xs">
                          Evidence confidence:{' '}
                          {Math.round(
                            recommendation.confidence * 100
                          )}
                          %
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>
                    No additional recommendation is currently supported
                    by the available KPI evidence.
                  </p>
                )}
              </Panel>

              <Panel title="Next Best Action">
                <p>{data.nextAction}</p>

                <Link
                  href="/brain/data-sources"
                  className="mt-4 inline-flex items-center gap-2 text-primary"
                >
                  Review data sources
                  <ArrowRight size={15} />
                </Link>
              </Panel>

              <Panel title="Business Areas">
                {areas.length ? (
                  <div className="flex flex-wrap gap-2">
                    {areas.map((area) => (
                      <span
                        key={area}
                        className="rounded-full border border-border/70 px-3 py-1.5 text-xs"
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p>No business areas have confirmed KPI evidence yet.</p>
                )}
              </Panel>
            </div>
          </>
        )}
      </div>
    </main>
  )
  }
