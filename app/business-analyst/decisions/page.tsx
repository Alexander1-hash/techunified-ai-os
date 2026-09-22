'use client'

import { useEffect, useState } from 'react'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Lightbulb,
} from 'lucide-react'

type Decision = {
  id: string
  type: 'opportunity' | 'attention' | 'signal'
  priority: 'high' | 'medium' | 'low'
  title: string
  message: string
  action: string
  evidence?: Record<string, unknown>
}

type DecisionResponse = {
  summary?: {
    customers?: number
    services?: number
    sales?: number
  }
  relationships?: {
    customersWithSales?: number
    customersWithoutSales?: number
    servicesWithSales?: number
    servicesWithoutSales?: number
    multiServiceCustomers?: number
  }
  decisions?: Decision[]
  methodology?: string[]
}

function DecisionIcon({
  type,
}: {
  type: Decision['type']
}) {
  if (type === 'attention') {
    return <AlertCircle size={18} />
  }

  if (type === 'opportunity') {
    return <Lightbulb size={18} />
  }

  return <Activity size={18} />
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
      <h2 className="font-semibold tracking-tight">
        {title}
      </h2>

      <div className="mt-3 text-sm leading-6 text-muted-foreground">
        {children}
      </div>
    </section>
  )
}

function DecisionCard({
  decision,
}: {
  decision: Decision
}) {
  return (
    <div className="rounded-xl border border-border/60 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 text-primary">
          <DecisionIcon type={decision.type} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium text-foreground">
                {decision.title}
              </p>

              <p className="mt-1">
                {decision.message}
              </p>
            </div>

            <span className="rounded-full border border-border/70 px-2.5 py-1 text-[11px] font-medium capitalize">
              {decision.priority} priority
            </span>
          </div>

          <div className="mt-4 rounded-lg bg-muted/40 p-3">
            <p className="text-xs font-medium text-foreground">
              Recommended action
            </p>

            <p className="mt-1 text-xs leading-5">
              {decision.action}
            </p>
          </div>

          {decision.evidence &&
          Object.keys(decision.evidence).length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(decision.evidence).map(
                ([key, value]) => (
                  <span
                    key={key}
                    className="rounded-full border border-border/60 px-2.5 py-1 text-[11px]"
                  >
                    {key.replace(
                      /([A-Z])/g,
                      ' $1',
                    )}{' '}
                    {String(value)}
                  </span>
                ),
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function DecisionsPage() {
  const [data, setData] =
    useState<DecisionResponse | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  useEffect(() => {
    let cancelled = false

    async function loadDecisions() {
      try {
        setLoading(true)
        setError('')

        const response = await fetch(
          '/api/business/decisions',
          {
            method: 'GET',
            cache: 'no-store',
          },
        )

        const json = await response.json()

        if (!response.ok) {
          throw new Error(
            json.error ||
              'Unable to load business decisions.',
          )
        }

        if (!cancelled) {
          setData(json)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load business decisions.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadDecisions()

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <main className="min-h-screen bg-background px-5 py-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">
              Business Analyst · Decision Engine
            </p>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
              Turn business activity into decisions.
            </h1>

            <p className="mt-4 max-w-3xl leading-7 text-muted-foreground">
              Reviewing confirmed customers, services,
              and sales evidence.
            </p>
          </header>

          <Panel title="Analyzing business activity">
            Checking confirmed organization records…
          </Panel>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background px-5 py-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">
              Business Analyst · Decision Engine
            </p>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
              Turn business activity into decisions.
            </h1>
          </header>

          <Panel title="Unable to load decisions">
            {error}
          </Panel>
        </div>
      </main>
    )
  }

  const summary = data?.summary ?? {}
  const relationships =
    data?.relationships ?? {}

  const decisions =
    data?.decisions ?? []

  const methodology =
    data?.methodology ?? []

  return (
    <main className="min-h-screen bg-background px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">
            Business Analyst · Decision Engine
          </p>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
            Turn business activity into decisions.
          </h1>

          <p className="mt-4 max-w-3xl leading-7 text-muted-foreground">
            TechUnified connects customers, services,
            and sales to surface evidence-backed
            signals, opportunities, and actions.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Panel title="Customers">
            <strong className="text-3xl text-foreground">
              {summary.customers ?? 0}
            </strong>

            <p>
              Confirmed customer records.
            </p>
          </Panel>

          <Panel title="Services">
            <strong className="text-3xl text-foreground">
              {summary.services ?? 0}
            </strong>

            <p>
              Services available to the
              organization.
            </p>
          </Panel>

          <Panel title="Sales">
            <strong className="text-3xl text-foreground">
              {summary.sales ?? 0}
            </strong>

            <p>
              Confirmed sales records.
            </p>
          </Panel>

          <Panel title="Decision signals">
            <strong className="text-3xl text-foreground">
              {decisions.length}
            </strong>

            <p>
              Signals supported by current
              evidence.
            </p>
          </Panel>
        </div>

        <div className="mt-4">
          <Panel title="Business decisions">
            {decisions.length ? (
              <div className="space-y-3">
                {decisions.map((decision) => (
                  <DecisionCard
                    key={decision.id}
                    decision={decision}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-border/60 p-4">
                <p className="font-medium text-foreground">
                  No decision signals yet.
                </p>

                <p className="mt-1">
                  TechUnified needs confirmed
                  customer, service, or sales
                  activity before it can surface
                  additional decisions.
                </p>
              </div>
            )}
          </Panel>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel title="Relationship intelligence">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/60 p-3">
                <p className="text-xs">
                  Customers with sales
                </p>

                <strong className="text-2xl text-foreground">
                  {relationships.customersWithSales ??
                    0}
                </strong>
              </div>

              <div className="rounded-xl border border-border/60 p-3">
                <p className="text-xs">
                  Customers without sales
                </p>

                <strong className="text-2xl text-foreground">
                  {relationships.customersWithoutSales ??
                    0}
                </strong>
              </div>

              <div className="rounded-xl border border-border/60 p-3">
                <p className="text-xs">
                  Services with sales
                </p>

                <strong className="text-2xl text-foreground">
                  {relationships.servicesWithSales ??
                    0}
                </strong>
              </div>

              <div className="rounded-xl border border-border/60 p-3">
                <p className="text-xs">
                  Services without sales
                </p>

                <strong className="text-2xl text-foreground">
                  {relationships.servicesWithoutSales ??
                    0}
                </strong>
              </div>

              <div className="rounded-xl border border-border/60 p-3 sm:col-span-2">
                <p className="text-xs">
                  Multi-service customers
                </p>

                <strong className="text-2xl text-foreground">
                  {relationships.multiServiceCustomers ??
                    0}
                </strong>
              </div>
            </div>
          </Panel>

          <Panel title="How the Decision Engine works">
            {methodology.length ? (
              <div className="space-y-3">
                {methodology.map(
                  (item, index) => (
                    <div
                      key={`${index}-${item}`}
                      className="flex gap-3"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border/70 text-xs text-foreground">
                        {index + 1}
                      </span>

                      <p>{item}</p>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p>
                  Decisions use organization-scoped
                  customers, services, and sales.
                </p>

                <p>
                  Signals are only generated when
                  the underlying records provide
                  supporting evidence.
                </p>
              </div>
            )}
          </Panel>
        </div>

        <div className="mt-4 rounded-2xl border border-border/70 bg-card p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">
                Decision Engine
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Evidence first. Action second.
              </p>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity size={16} />
              Live organization evidence
              <ArrowRight size={15} />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
