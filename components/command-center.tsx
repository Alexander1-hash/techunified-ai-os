'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import {
  Activity,
  ArrowRight,
  BarChart3,
  Brain,
  Bot,
  CheckCircle2,
  Database,
  FileBarChart,
  Lightbulb,
  LoaderCircle,
  MessageSquare,
  Plus,
  Sparkles,
  Workflow,
  Zap,
} from 'lucide-react'

type Session = {
  id: string
  title: string
  prompt: string
  session_type: string
  status: string
  created_at: string
}

type Decision = {
  id: string
  type: 'opportunity' | 'attention' | 'signal'
  priority: 'high' | 'medium' | 'low'
  title: string
  message: string
  action: string
  evidence?: Record<string, unknown>
}

type WorkspaceData = {
  agents?: number
  workflows?: number
  knowledge?: number
  activity?: number
  automations?: number
  analytics?: number
  sessions?: Session[]
}

type DecisionResponse = { decisions?: Decision[] }

const fetcher = async (url: string) => {
  const response = await fetch(url)
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Unable to load workspace.')
  return data
}

const countValue = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0

export function CommandCenter() {
  const { profile, user } = useAuth()
  const { data, error, isLoading, mutate } = useSWR<WorkspaceData>('/api/workspace', fetcher)
  const { data: decisionData, error: decisionError, isLoading: decisionsLoading } =
    useSWR<DecisionResponse>('/api/business/decisions', fetcher)

  const [prompt, setPrompt] = useState('')
  const [state, setState] = useState<'idle' | 'creating' | 'success' | 'failed'>('idle')
  const [message, setMessage] = useState('')
  const [session, setSession] = useState<Session | null>(null)
  const decisions = decisionData?.decisions ?? []

  const displayName = String(
    profile?.full_name ??
      user?.user_metadata?.full_name ??
      user?.user_metadata?.name ??
      user?.email?.split('@')[0] ??
      'there',
  ).trim() || 'there'

  async function createSession(sessionType = 'session') {
    if (!prompt.trim() || state === 'creating') return
    setState('creating')
    setMessage('Creating a secure organization-scoped session…')
    try {
      const response = await fetch('/api/ai/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt, sessionType }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to create the session.')
      setSession(result.session)
      setState('success')
      setMessage('Session created. It is ready to reopen from Recent work.')
      await mutate()
    } catch (createError) {
      setState('failed')
      setMessage(createError instanceof Error ? createError.message : 'Unable to create the session.')
    }
  }

  const stats = [
    { label: 'AI Agents', value: data?.agents, detail: 'Active agents', href: '/agents', icon: Bot },
    { label: 'Workflows', value: data?.workflows, detail: 'Automated workflows', href: '/workflows', icon: Workflow },
    { label: 'Automations', value: data?.automations, detail: 'Active automations', href: '/automations', icon: Zap },
    { label: 'Knowledge', value: data?.knowledge, detail: 'Connected sources', href: '/brain/data-sources', icon: Database },
    { label: 'Analytics', value: data?.analytics, detail: 'Insights generated', href: '/analytics', icon: BarChart3 },
  ]

  const operatingLayers = [
    { eyebrow: 'Agents', title: 'AI Agents', description: 'Create and manage autonomous AI agents.', href: '/agents', icon: Bot, status: countValue(data?.agents) + ' configured' },
    { eyebrow: 'Build', title: 'AI Studio', description: 'Build and configure AI capabilities.', href: '/studio', icon: Sparkles, status: 'Open studio' },
    { eyebrow: 'Process', title: 'Workflows', description: 'Connect tasks and automate processes.', href: '/workflows', icon: Workflow, status: countValue(data?.workflows) + ' workflows' },
    { eyebrow: 'Run', title: 'Automations', description: 'Monitor and manage active automations.', href: '/automations', icon: Zap, status: countValue(data?.automations) + ' active' },
  ]

  const intelligenceLayers = [
    { title: 'Analytics', description: 'Track business performance and activity.', href: '/analytics', icon: BarChart3 },
    { title: 'Decision Engine', description: 'Generate AI-assisted business decisions.', href: '/business-analyst/decisions', icon: Lightbulb },
    { title: 'Forecast', description: 'Identify trends and future opportunities.', href: '/business-analyst/forecast', icon: Activity },
    { title: 'Reports', description: 'Generate and organize business reports.', href: '/reports', icon: FileBarChart },
  ]

  return (
    <div className="min-w-0 space-y-8">
      <section className="flex min-w-0 flex-col gap-5 border-b border-border pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.2em] text-primary">
            <span className="size-1.5 rounded-full bg-primary" />
            Command Center
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Good morning, {displayName}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Your company workspace for AI agents, workflows, knowledge and business intelligence.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button type="button" onClick={() => { setPrompt(''); setState('idle'); setMessage('') }}
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium transition hover:border-primary/50 hover:bg-muted">
            <MessageSquare size={16} /> New AI Session
          </button>
          <Link href="/agents" className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
            <Plus size={16} /> Create Agent
          </Link>
        </div>
      </section>

      <section aria-labelledby="command-center-actions">
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-muted-foreground">Command Center</p>
          <h2 id="command-center-actions" className="mt-1 text-lg font-semibold">Your AI-powered company workspace</h2>
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CommandAction href="/agents" icon={<Bot size={18} />} title="Create AI Agent" description="Deploy an intelligent worker." />
          <CommandAction href="/workflows" icon={<Workflow size={18} />} title="Create Workflow" description="Connect tasks into a process." />
          <CommandAction href="/brain/data-sources" icon={<Database size={18} />} title="Add Knowledge" description="Connect company information." />
          <CommandAction href="/business-analyst" icon={<BarChart3 size={18} />} title="Run Analysis" description="Turn verified data into insight." />
        </div>
      </section>

      <section aria-labelledby="overview">
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-muted-foreground">Overview</p>
          <h2 id="overview" className="mt-1 text-lg font-semibold">Operating layer</h2>
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <Link key={stat.label} href={stat.href} className="group min-w-0 rounded-xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/40">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[.12em] text-muted-foreground">{stat.label}</span>
                  <Icon size={16} className="shrink-0 text-primary" />
                </div>
                <p className="mt-5 text-2xl font-semibold tracking-tight">{isLoading ? '—' : countValue(stat.value)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{stat.detail}</p>
                <ArrowRight size={15} className="mt-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
              </Link>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="ai-automation">
        <SectionHeading label="AI & Automation" title="Build intelligent operations" description="Build intelligent agents and automate repetitive business processes." />
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {operatingLayers.map((item) => {
            const Icon = item.icon
            return <LayerCard key={item.title} href={item.href} icon={<Icon size={19} />} eyebrow={item.eyebrow} title={item.title} description={item.description} status={item.status} />
          })}
        </div>
      </section>

      <section aria-labelledby="business-intelligence">
        <SectionHeading label="Business Intelligence" title="Turn company data into action" description="Use verified business information to understand performance and make decisions." />
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {intelligenceLayers.map((item) => {
            const Icon = item.icon
            return <LayerCard key={item.title} href={item.href} icon={<Icon size={19} />} title={item.title} description={item.description} />
          })}
        </div>
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[1.35fr_.65fr]">
        <div className="min-w-0 rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-primary">Company Brain</p>
              <h2 className="mt-2 text-xl font-semibold">Your centralized AI knowledge layer</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Connect the information your AI and business intelligence need to understand the company.</p>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Brain size={19} /></div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <BrainStat label="Knowledge Sources" value={data?.knowledge} />
            <BrainStat label="Documents" value={0} />
            <BrainStat label="Data Sources" value={data?.knowledge} />
          </div>
          <Link href="/brain/data-sources" className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
            <Plus size={16} /> Add Knowledge Source
          </Link>
        </div>

        <div className="min-w-0 rounded-xl border border-border bg-card p-5 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-muted-foreground">Activity</p>
          <h2 className="mt-2 text-xl font-semibold">Recent activity</h2>
          {error ? <p className="mt-5 text-sm text-destructive">{error.message}</p> :
            data?.sessions?.length ? (
              <div className="mt-5 space-y-1">
                {data.sessions.slice(0, 4).map((item) => (
                  <Link key={item.id} href={'/workspace/sessions/' + item.id} className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-3 transition hover:bg-muted">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><CheckCircle2 size={15} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.session_type} · {item.status}</p>
                    </div>
                    <ArrowRight size={14} className="shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-lg border border-dashed border-border p-4">
                <p className="text-sm font-medium">No activity yet</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Activity will appear here when you create agents, workflows, automations or knowledge sources.</p>
              </div>
            )}
          <Link href="/activity" className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-primary">View activity <ArrowRight size={14} /></Link>
        </div>
      </section>

      <section aria-labelledby="decision-engine" className="min-w-0 rounded-xl border border-primary/20 bg-primary/[0.04] p-5 sm:p-6">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-primary">Decision Engine</p>
            <h2 id="decision-engine" className="mt-2 text-xl font-semibold">What requires attention?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">TechUnified evaluates organization-scoped customers, services and sales evidence for business signals.</p>
          </div>
          <Link href="/business-analyst/decisions" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:border-primary/50">
            Open Decision Engine <ArrowRight size={15} />
          </Link>
        </div>
        {decisionError ? <p className="mt-5 text-sm text-destructive">{decisionError.message}</p> :
          decisionsLoading ? <div className="mt-5 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Reviewing current business evidence…</div> :
          decisions.length ? (
            <div className="mt-5 grid min-w-0 gap-3 lg:grid-cols-3">
              {decisions.slice(0, 3).map((decision) => (
                <div key={decision.id} className="min-w-0 rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-sm font-medium">{decision.title}</p>
                    <span className="shrink-0 rounded-full border border-border px-2 py-1 text-[10px] font-medium capitalize">{decision.priority}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{decision.message}</p>
                  <div className="mt-3 rounded-lg bg-muted p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-primary">Recommended action</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{decision.action}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-border bg-card p-4">
              <p className="text-sm font-medium">No decision signals yet</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Confirmed customer, service or sales activity will give the Decision Engine evidence to analyze.</p>
            </div>
          )}
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <div className="min-w-0 rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Brain size={18} /></div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-primary">AI Command Surface</p>
              <h2 className="mt-2 text-xl font-semibold">Ask TechUnified to move work forward</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Create a real organization-scoped AI session grounded in your company context.</p>
            </div>
          </div>
          <div className="mt-5 overflow-hidden rounded-lg border border-border bg-background">
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value.slice(0, 4000))} aria-label="AI task prompt" placeholder="Ask, analyze, draft, or plan something for your company…" className="min-h-28 w-full resize-none border-0 bg-transparent p-4 text-sm leading-6 outline-none" />
            <div className="flex flex-col gap-3 border-t border-border p-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-muted-foreground">{prompt.length}/4,000</span>
              <button type="button" onClick={() => createSession()} disabled={!prompt.trim() || state === 'creating'} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
                {state === 'creating' ? <LoaderCircle className="animate-spin" size={15} /> : <ArrowRight size={15} />}
                {state === 'creating' ? 'Creating…' : 'Open AI session'}
              </button>
            </div>
          </div>
          {message && <p role="status" className={'mt-3 text-sm ' + (state === 'failed' ? 'text-destructive' : 'text-muted-foreground')}>{message}</p>}
          {session && state === 'success' && (
            <Link href={'/workspace/sessions/' + session.id} className="mt-3 block rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm hover:border-primary">
              <span className="font-medium">{session.title}</span>
              <span className="mt-1 block text-xs text-muted-foreground">Pending AI work · Open session</span>
            </Link>
          )}
          {state === 'failed' && <button type="button" onClick={() => createSession()} className="mt-3 rounded-lg border border-border px-3 py-2 text-sm hover:border-primary">Retry</button>}
        </div>

        <div className="min-w-0 rounded-xl border border-border bg-card p-5 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-muted-foreground">Recent Work</p>
          <h2 className="mt-2 text-xl font-semibold">{data?.sessions?.length ? 'Reopen recent AI work' : 'No AI work yet'}</h2>
          {data?.sessions?.length ? (
            <div className="mt-4 divide-y divide-border">
              {data.sessions.slice(0, 5).map((item) => (
                <Link key={item.id} href={'/workspace/sessions/' + item.id} className="flex min-w-0 items-center gap-3 py-3 transition hover:text-primary">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-primary"><MessageSquare size={14} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.session_type} · {item.status}</p>
                  </div>
                  <ArrowRight size={14} className="shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-border p-4">
              <p className="text-sm font-medium">Start your first AI task</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Your real organization-scoped sessions will appear here after you create them.</p>
            </div>
          )}
          <Link href="/activity" className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-primary">View full activity <ArrowRight size={14} /></Link>
        </div>
      </section>
    </div>
  )
}

function SectionHeading({ label, title, description }: { label: string; title: string; description: string }) {
  return (
    <div className="mb-4 min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-primary">{label}</p>
      <h2 className="mt-1 text-xl font-semibold">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}

function CommandAction({ href, icon, title, description }: { href: string; icon: React.ReactNode; title: string; description: string }) {
  return (
    <Link href={href} className="group min-w-0 rounded-xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/40">
      <div className="flex items-center justify-between gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
        <ArrowRight size={15} className="text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
      </div>
      <h3 className="mt-4 text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </Link>
  )
}

function LayerCard({ href, icon, eyebrow, title, description, status }: { href: string; icon: React.ReactNode; eyebrow?: string; title: string; description: string; status?: string }) {
  return (
    <Link href={href} className="group min-w-0 rounded-xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">{icon}</div>
        <ArrowRight size={15} className="text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
      </div>
      {eyebrow && <p className="mt-4 text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">{eyebrow}</p>}
      <h3 className="mt-1 text-base font-semibold">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      {status && <p className="mt-4 text-xs font-medium text-primary">{status}</p>}
    </Link>
  )
}

function BrainStat({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold">{countValue(value)}</p>
    </div>
  )
}
