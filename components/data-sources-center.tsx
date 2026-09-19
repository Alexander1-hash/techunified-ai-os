'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  Upload,
  XCircle,
} from 'lucide-react'
import { Card } from '@/components/ui'

type Source = {
  id: string
  name: string
  provider: string
  category: string
  status: string
  configuration_metadata?: Record<string, unknown> | null
  last_synced_at?: string | null
  created_at?: string
  updated_at?: string
}

type Column = {
  name: string
  type: string
  missing: number
}

type Provider = 'supabase' | 'csv' | 'excel' | null

const sourceOptions = [
  {
    id: 'supabase' as const,
    name: 'Supabase',
    description:
      'Connect your organization database and verify the current business data layer.',
    icon: Database,
    supported: true,
  },
  {
    id: 'csv' as const,
    name: 'CSV',
    description:
      'Upload structured business data from a CSV file.',
    icon: FileText,
    supported: true,
  },
  {
    id: 'excel' as const,
    name: 'Excel',
    description:
      'Upload an Excel workbook and inspect its business data.',
    icon: FileSpreadsheet,
    supported: true,
  },
  {
    id: 'google-sheets',
    name: 'Google Sheets',
    description:
      'Connect a Google Sheets data source.',
    icon: FileSpreadsheet,
    supported: false,
  },
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    description:
      'Connect an external PostgreSQL database.',
    icon: Database,
    supported: false,
  },
  {
    id: 'crm',
    name: 'CRM',
    description:
      'Connect customer and sales records from a CRM.',
    icon: Database,
    supported: false,
  },
  {
    id: 'accounting',
    name: 'Accounting',
    description:
      'Connect financial and accounting records.',
    icon: Database,
    supported: false,
  },
  {
    id: 'analytics',
    name: 'Analytics',
    description:
      'Connect analytics and performance data.',
    icon: Database,
    supported: false,
  },
]

const supportedMetrics = [
  'Revenue',
  'Sales',
  'Orders',
  'Customers',
  'Leads',
  'Expenses',
  'Profit',
  'Conversion Rate',
  'Churn',
  'Retention',
  'Inventory',
  'Transactions',
]

export function DataSourcesCenter() {
  const [active, setActive] = useState<Provider>(null)
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<Source | null>(null)
  const [columns, setColumns] = useState<Column[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const fileRef = useRef<HTMLInputElement | null>(null)

  const connectedProviders = useMemo(
    () =>
      new Set(
        sources.map((source) => source.provider),
      ),
    [sources],
  )

  async function loadSources() {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(
        '/api/brain/data-sources',
        {
          method: 'GET',
          cache: 'no-store',
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Unable to load data sources.',
        )
      }

      setSources(
        Array.isArray(data?.sources)
          ? data.sources
          : [],
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load data sources.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSources()
  }, [])

  function resetFeedback() {
    setMessage('')
    setError('')
    setResult(null)
    setColumns([])
    setMapping({})
  }

  function openSetup(provider: Provider) {
    resetFeedback()
    setActive(provider)

    window.setTimeout(() => {
      document
        .getElementById('data-source-setup')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
    }, 50)
  }

  function closeSetup() {
    resetFeedback()
    setActive(null)
  }

  async function verifySupabase() {
    setBusy(true)
    setMessage('')
    setError('')

    try {
      const form = new FormData()
      form.append('provider', 'supabase')

      const response = await fetch(
        '/api/brain/data-sources',
        {
          method: 'POST',
          body: form,
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Supabase verification failed.',
        )
      }

      setResult(data?.source ?? null)

      setMessage(
        'Supabase connection verified successfully.',
      )

      await loadSources()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Supabase verification failed.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function upload(file: File) {
    setBusy(true)
    setMessage('')
    setError('')
    setResult(null)
    setColumns([])
    setMapping({})

    try {
      const provider =
        file.name
          .toLowerCase()
          .endsWith('.xlsx')
          ? 'excel'
          : 'csv'

      const form = new FormData()

      form.append('provider', provider)
      form.append('file', file)

      const response = await fetch(
        '/api/brain/data-sources',
        {
          method: 'POST',
          body: form,
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'The file could not be imported.',
        )
      }

      setResult(data?.source ?? null)

      setColumns(
        Array.isArray(data?.columns)
          ? data.columns
          : [],
      )

      setMessage(
        `File imported successfully. ${
          data?.recordsPersisted ?? 0
        } records were saved.`,
      )

      await loadSources()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'The file could not be imported.',
      )
    } finally {
      setBusy(false)

      if (fileRef.current) {
        fileRef.current.value = ''
      }
    }
  }

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    void upload(file)
  }

  async function saveMappings() {
    if (!result?.id) {
      setError(
        'Import a data source before saving mappings.',
      )
      return
    }

    const mappings = Object.entries(mapping)
      .filter(([, metric]) => metric)
      .map(([column, metric]) => ({
        column,
        metric,
      }))

    if (!mappings.length) {
      setError(
        'Select at least one KPI mapping.',
      )
      return
    }

    setBusy(true)
    setMessage('')
    setError('')

    try {
      const response = await fetch(
        '/api/business/analysis',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sourceId: result.id,
            mappings,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'The KPI mappings could not be saved.',
        )
      }

      setMessage(
        'KPI mappings saved successfully.',
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'The KPI mappings could not be saved.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-w-0 space-y-6 p-4 sm:p-6">

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

        <div>

          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
            Company Brain · Data Sources
          </p>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            Connect your business data
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Bring verified business data into TechUnified
            so the Business Analyst can generate
            evidence-based insights, reports, forecasts,
            and recommendations.
          </p>

        </div>

        <button
          type="button"
          onClick={() => void loadSources()}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >

          <RefreshCw
            className={`h-4 w-4 ${
              loading ? 'animate-spin' : ''
            }`}
          />

          Refresh

        </button>

      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">

          <XCircle className="mt-0.5 h-5 w-5 shrink-0" />

          <div>

            <p className="font-semibold">
              Something needs attention
            </p>

            <p className="mt-1">
              {error}
            </p>

          </div>

        </div>
      )}

      {message && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">

          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />

          <div>

            <p className="font-semibold">
              Data source update
            </p>

            <p className="mt-1">
              {message}
            </p>

          </div>

        </div>
      )}

      <section className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">

        {sourceOptions.map((source) => {

          const Icon = source.icon

          const connected =
            connectedProviders.has(source.id)

          return (
            <Card
              key={source.id}
              className="flex min-w-0 flex-col"
            >

              <div className="flex items-start justify-between gap-3">

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <Icon className="h-5 w-5" />
                </div>

                {connected &&
                  source.supported && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Connected
                    </span>
                  )}

                {!source.supported && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                    Coming soon
                  </span>
                )}

              </div>

              <h2 className="mt-5 text-lg font-semibold text-slate-950">
                {source.name}
              </h2>

              <p className="mt-2 min-h-[48px] text-sm leading-6 text-slate-600">
                {source.description}
              </p>

              <div className="mt-5">

                {source.supported ? (
                  <button
                    type="button"
                    onClick={() =>
                      openSetup(source.id)
                    }
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[0.99]"
                  >
                    {connected
                      ? 'Manage source'
                      : 'Open setup'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-400"
                  >
                    Coming soon
                  </button>
                )}

              </div>

            </Card>
          )
        })}

      </section>

      <section className="space-y-4">

        <div className="flex items-center justify-between gap-3">

          <div>

            <h2 className="text-lg font-semibold text-slate-950">
              Connected sources
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              Sources available to the Business Analyst.
            </p>

          </div>

        </div>

        {loading ? (
          <Card>

            <div className="flex items-center gap-3 text-sm text-slate-600">

              <Loader2 className="h-4 w-4 animate-spin" />

              Loading data sources...

            </div>

          </Card>
        ) : sources.length === 0 ? (
          <Card>

            <div className="py-6 text-center">

              <Database className="mx-auto h-8 w-8 text-slate-300" />

              <p className="mt-3 font-medium text-slate-900">
                No connected sources yet
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Connect Supabase or upload a
                CSV/Excel file to begin.
              </p>

            </div>

          </Card>
        ) : (
          <div className="grid gap-3">

            {sources.map((source) => (
              <Card key={source.id}>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                  <div className="min-w-0">

                    <div className="flex flex-wrap items-center gap-2">

                      <h3 className="font-semibold text-slate-950">
                        {source.name}
                      </h3>

                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium capitalize text-emerald-700">
                        {source.status}
                      </span>

                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      {source.provider} · {source.category}
                    </p>

                  </div>

                  {source.last_synced_at && (
                    <p className="text-xs text-slate-500">
                      Last synced{' '}
                      {new Date(
                        source.last_synced_at,
                      ).toLocaleString()}
                    </p>
                  )}

                </div>

              </Card>
            ))}

          </div>
        )}

      </section>
            {active && (
        <section
          id="data-source-setup"
          className="scroll-mt-6"
        >

          <Card className="border-slate-300 bg-white">

            <div className="flex items-start justify-between gap-4">

              <div>

                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
                  Data source setup
                </p>

                <h2 className="mt-2 text-xl font-semibold text-slate-950">

                  {active === 'supabase'
                    ? 'Verify Supabase'
                    : active === 'csv'
                      ? 'Import CSV'
                      : 'Import Excel'}

                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-600">

                  {active === 'supabase'
                    ? 'Verify the organization database connection and make it available to the Business Analyst.'
                    : 'Upload your business data and let TechUnified inspect the columns before KPI mapping.'}

                </p>

              </div>

              <button
                type="button"
                onClick={closeSetup}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                aria-label="Close setup"
              >
                <XCircle className="h-5 w-5" />
              </button>

            </div>

            {active === 'supabase' && (
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                  <div>

                    <p className="font-medium text-slate-900">
                      Organization database
                    </p>

                    <p className="mt-1 text-sm text-slate-600">
                      TechUnified will verify the current
                      authenticated Supabase organization
                      connection.
                    </p>

                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void verifySupabase()
                    }
                    disabled={busy}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >

                    {busy && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}

                    {busy
                      ? 'Verifying...'
                      : 'Verify connection'}

                  </button>

                </div>

              </div>
            )}

            {(active === 'csv' ||
              active === 'excel') && (
              <div className="mt-6 space-y-5">

                <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-slate-400 hover:bg-slate-100">

                  <Upload className="h-8 w-8 text-slate-400" />

                  <span className="mt-3 font-semibold text-slate-900">
                    Choose{' '}
                    {active === 'csv'
                      ? 'CSV'
                      : 'Excel'}{' '}
                    file
                  </span>

                  <span className="mt-1 text-xs text-slate-500">
                    Maximum file size: 10 MB
                  </span>

                  <input
                    ref={fileRef}
                    type="file"
                    accept={
                      active === 'csv'
                        ? '.csv,text/csv'
                        : '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    }
                    className="sr-only"
                    onChange={handleFileChange}
                    disabled={busy}
                  />

                </label>

                {busy && (
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">

                    <Loader2 className="h-4 w-4 animate-spin" />

                    Inspecting and importing your file...

                  </div>
                )}

              </div>
            )}

            {columns.length > 0 &&
              result && (
                <div className="mt-6 space-y-5">

                  <div>

                    <h3 className="font-semibold text-slate-950">
                      KPI mapping
                    </h3>

                    <p className="mt-1 text-sm text-slate-600">
                      Tell TechUnified which columns
                      represent your business metrics.
                    </p>

                  </div>

                  <div className="space-y-3">

                    {columns.map((column) => (
                      <div
                        key={column.name}
                        className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_220px]"
                      >

                        <div className="min-w-0">

                          <p className="truncate text-sm font-medium text-slate-900">
                            {column.name}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Detected type:{' '}
                            {column.type} · Missing:{' '}
                            {column.missing}
                          </p>

                        </div>

                        <select
                          value={
                            mapping[column.name] ?? ''
                          }
                          onChange={(event) =>
                            setMapping(
                              (current) => ({
                                ...current,
                                [column.name]:
                                  event.target.value,
                              }),
                            )
                          }
                          className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                        >

                          <option value="">
                            No KPI mapping
                          </option>

                          {supportedMetrics.map(
                            (metric) => (
                              <option
                                key={metric}
                                value={metric}
                              >
                                {metric}
                              </option>
                            ),
                          )}

                        </select>

                      </div>
                    ))}

                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void saveMappings()
                    }
                    disabled={busy}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >

                    {busy && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}

                    Save KPI mappings

                  </button>

                </div>
              )}

          </Card>

        </section>
      )}

      <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-5">

        <Link
          href="/brain"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Company Brain
        </Link>

        <Link
          href="/business-analyst"
          className="inline-flex min-h-11 items-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Open Business Analyst
        </Link>

      </div>

    </main>
                    }
