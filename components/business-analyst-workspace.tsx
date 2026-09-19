'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'

const areas = [
  'Finance',
  'Sales',
  'Marketing',
  'Customers',
  'Operations',
  'Product',
  'Workforce',
  'Risk',
]

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

export function BusinessAnalystWorkspace({
  mode = 'dashboard',
}: {
  mode?: string
}) {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const endpoint =
      mode === 'dashboard'
        ? '/api/business/analysis'
        : mode === 'forecast'
          ? '/api/business/forecast'
          : null

    if (!endpoint) return

    setData(null)
    setError('')

    fetch(endpoint)
      .then(async (response) => {
        const json = await response.json()

        if (!response.ok) {
          throw new Error(json.error || 'Unable to load business data.')
        }

        setData(json)
      })
      .catch((err) => {
        setError(err.message || 'Unable to load business data.')
      })
  }, [mode])

  if (mode === 'forecast') {
    if (error) {
      return (
        <main className="min-h-screen bg-background px-5 py-8">
          <div className="mx-auto max-w-7xl">
            <Panel title="Unable to load forecast">{error}</Panel>
          </div>
        </main>
      )
    }

    if (!data) {
      return (
        <main className="min-h-screen bg-background px-5 py-8">
          <div className="mx-auto max-w-7xl">
            <Panel title="Loading forecast">
              Checking verified business evidence…
            </Panel>
          </div>
        </main>
      )
    }

    const forecasts = data.forecasts ?? []
    const recommendations = data.recommendations ?? []

    return (
      <main className="min-h-screen bg-background px-5 py-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">
              Business Analyst · Forecast
            </p>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
              See where your business is heading.
            </h1>

            <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
              Forecasts are calculated from verified organization KPI records.
              TechUnified does not invent missing business data.
            </p>
          </header>

          {!forecasts.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Panel title="More data required">
                {data.message ||
                  'More verified historical KPI data is required before TechUnified can produce a forecast.'}
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
                <Panel title="Forecast signals">
                  <strong className="text-3xl text-foreground">
                    {forecasts.length}
                  </strong>
                  <p>Verified KPI forecast signals.</p>
                </Panel>

                <Panel title="Upward signals">
                  <strong className="text-3xl text-foreground">
                    {
                      forecasts.filter(
                        (item: any) => item.direction === 'up'
                      ).length
                    }
                  </strong>
                  <p>KPIs currently trending upward.</p>
                </Panel>

                <Panel title="Downward signals">
                  <strong className="text-3xl text-foreground">
                    {
                      forecasts.filter(
                        (item: any) => item.direction === 'down'
                      ).length
                    }
                  </strong>
                  <p>KPIs requiring closer review.</p>
                </Panel>

                <Panel title="Evidence status">
                  <strong className="text-3xl text-foreground">
                    Verified
                  </strong>
                  <p>Based on organization-scoped KPI records.</p>
                </Panel>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Forecast overview">
                  <div className="space-y-4">
                    {forecasts.map((item: any) => (
                      <div
                        key={item.name}
                        className="rounded-xl border border-border/60 p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium text-foreground">
                              {item.name}
                            </p>

                            <p className="text-xs">
                              {item.source || 'Verified KPI'} ·{' '}
                              {item.period || 'Recorded period'}
                            </p>
                          </div>

                          <span className="rounded-full border px-2.5 py-1 text-xs capitalize">
                            {item.direction}
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <div>
                            <p className="text-xs">Current</p>
                            <strong className="text-foreground">
                              {item.current} {item.unit || ''}
                            </strong>
                          </div>

                          <div>
                            <p className="text-xs">Previous</p>
                            <strong className="text-foreground">
                              {item.previous} {item.unit || ''}
                            </strong>
                          </div>

                          <div>
                            <p className="text-xs">Change</p>
                            <strong className="text-foreground">
                              {item.changePercent}%
                            </strong>
                          </div>

                          <div>
                            <p className="text-xs">Projected</p>
                            <strong className="text-foreground">
                              {item.projected} {item.unit || ''}
                            </strong>
                          </div>
                        </div>

                        <p className="mt-3 text-xs">
                          Confidence: {item.confidence} · Evidence periods:{' '}
                          {item.evidencePeriods}
                        </p>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel title="Forecast recommendations">
                  {recommendations.length ? (
                    <div className="space-y-4">
                      {recommendations.map((item: any) => (
                        <div
                          key={`${item.title}-${item.action}`}
                          className="rounded-xl border border-border/60 p-4"
                        >
                          <p className="font-medium text-foreground">
                            {item.title}
                          </p>

                          <p className="mt-1">{item.message}</p>

                          <p className="mt-2 font-medium text-foreground">
                            Suggested next step: {item.action}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>
                      No directional recommendation is currently supported by
                      the verified KPI evidence.
                    </p>
                  )}
                </Panel>

                <Panel title="Forecast methodology">
                  <p>
                    TechUnified compares the latest recorded KPI value with
                    its previous recorded value and projects the same observed
                    change forward.
                  </p>

                  <p className="mt-2">
                    Forecast confidence reflects the number of available
                    evidence periods. It is not a guarantee of future results.
                  </p>
                </Panel>

                <Panel title="Data areas">
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
                </Panel>
              </div>
            </>
          )}
        </div>
      </main>
    )
  }

  if (mode !== 'dashboard') {
    return (
      <main className="min-h-screen bg-background px-5 py-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">
              Business Analyst
            </p>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
              Evidence before conclusions.
            </h1>

            <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
              This view remains grounded in verified organization data.
            </p>
          </header>

          <Panel title="Insufficient data">
            Connect and confirm a source mapping to begin analysis.
          </Panel>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="p-6">
        <Panel title="Unable to load analysis">{error}</Panel>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="p-6">
        <Panel title="Loading analysis">
          Checking verified business evidence…
        </Panel>
      </main>
    )
  }

  const hasData = data.kpis.length > 0

  return (
    <main className="min-h-screen bg-background px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">
            Business Analyst
          </p>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
            Understand what is happening in your business.
          </h1>

          <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
            Only confirmed KPI mappings and organization-scoped records appear
            here.
          </p>
        </header>

        {!hasData ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Insufficient business data">
              Connect a source and confirm at least one KPI mapping before
              calculating a score.
            </Panel>

            <Panel title="Next best action">
              <Link
                href="/brain/data-sources"
                className="inline-flex items-center gap-2 text-primary"
              >
                Connect your first source
                <ArrowRight size={15} />
              </Link>
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
                  Based on {data.kpis.length} verified KPI
                  {data.kpis.length === 1 ? '' : 's'}.
                </p>
              </Panel>

              <Panel title="Data coverage">
                <strong className="text-3xl text-foreground">
                  {data.quality}%
                </strong>
                <p>{data.areas.length} KPI areas covered.</p>
              </Panel>

              <Panel title="KPI overview">
                <strong className="text-3xl text-foreground">
                  {data.kpis.length}
                </strong>
                <p>Confirmed values available.</p>
              </Panel>

              <Panel title="Next best action">{data.nextAction}</Panel>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Panel title="KPI overview">
                <div className="space-y-3">
                  {data.kpis.map((k: any) => (
                    <div
                      className="flex items-center justify-between gap-4 border-b border-border/60 pb-3"
                      key={k.id}
                    >
                      <div>
                        <p className="font-medium text-foreground">
                          {k.name}
                        </p>

                        <p className="text-xs">
                          {k.source} · {k.period} · {k.status}
                        </p>
                      </div>

                      <strong className="text-foreground">
                        {k.value} {k.unit}
                      </strong>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Evidence-based recommendations">
                {data.recommendations.length ? (
                  <div className="space-y-4">
                    {data.recommendations.map((r: any) => (
                      <div key={r.title}>
                        <p className="font-medium text-foreground">
                          {r.title}
                        </p>

                        <p>{r.problem}</p>

                        <p className="mt-1 text-foreground">
                          {r.recommended_action}
                        </p>

                        <p className="text-xs">
                          Confidence {Math.round(r.confidence * 100)}%
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  'Recommendations appear only when supported by comparable KPI evidence.'
                )}
              </Panel>

              <Panel title="Data quality">
                {data.quality}% verified KPI coverage. Freshness and
                completeness warnings remain attached to each imported source.
              </Panel>

              <Panel title="Business areas covered">
                <div className="flex flex-wrap gap-2">
                  {areas.map((area) => (
                    <span
                      key={area}
                      className={`rounded-full border px-3 py-1.5 text-xs ${
                        data.areas.includes(area)
                          ? 'border-primary text-primary'
                          : 'border-border/70'
                      }`}
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </Panel>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

export function BusinessAnalystNav() {
  return (
    <nav
      aria-label="Business intelligence"
      className="flex flex-wrap gap-2"
    >
      <Link href="/brain">Company Brain</Link>
      <Link href="/business-analyst">Analyst</Link>
      <Link href="/brain/data-sources">Data Sources</Link>
      <Link href="/business-analyst/forecast">Forecast</Link>
      <Link href="/reports">Reports</Link>
    </nav>
  )
                                        }
