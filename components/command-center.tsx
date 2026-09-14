'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { useState } from 'react'
import { ArrowRight, Brain, Film, LoaderCircle, MessageSquare, Plus, Sparkles, Workflow, Zap } from 'lucide-react'
import { Card, PageHeader } from '@/components/ui'

type Session = { id: string; title: string; prompt: string; session_type: string; status: string; created_at: string }
const fetcher = async (url: string) => { const response = await fetch(url); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to load workspace.'); return data }

export function CommandCenter() {
  const { data, error, isLoading, mutate } = useSWR('/api/workspace', fetcher)
  const [prompt, setPrompt] = useState('')
  const [state, setState] = useState<'idle' | 'creating' | 'success' | 'failed'>('idle')
  const [message, setMessage] = useState('')
  const [session, setSession] = useState<Session | null>(null)

  async function createSession(sessionType = 'session') {
    if (!prompt.trim() || state === 'creating') return
    setState('creating'); setMessage('Creating a secure organization-scoped session…')
    try {
      const response = await fetch('/api/ai/sessions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt, sessionType }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to create the session.')
      setSession(result.session); setState('success'); setMessage('Session created. It is ready to reopen from Recent work.'); await mutate()
    } catch (createError) { setState('failed'); setMessage(createError instanceof Error ? createError.message : 'Unable to create the session.') }
  }

  return <div className="space-y-6">
    <PageHeader eyebrow="Command center" title="AI Workspace" subtitle="Your central command center for working with AI across your company." action={<div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setPrompt(''); setState('idle'); setMessage('') }} className="flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium"><MessageSquare size={16}/> New AI Session</button><button type="button" onClick={() => setPrompt('Describe the business task you want to move forward.')} className="flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"><Plus size={16}/> Start Task</button></div>}/>
    <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
      <Card className="min-h-[430px] overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card"><div className="flex items-start gap-4"><div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Brain size={21}/></div><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">AI command surface</p><h2 className="mt-2 text-xl font-semibold">What do you want to move forward?</h2><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Create a real, organization-scoped AI session grounded in your company context. No response is fabricated before an AI request runs.</p></div></div>
        <div className="mt-8 flex min-h-32 flex-col justify-between rounded-xl border bg-background/50 p-3"><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} aria-label="AI task prompt" placeholder="Ask, analyze, draft, or plan something for your company..." className="min-h-16 resize-none bg-transparent p-2 text-sm outline-none"/><div className="flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{prompt.length}/4,000</span><button type="button" onClick={() => createSession()} disabled={!prompt.trim() || state === 'creating'} className="flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{state === 'creating' ? <LoaderCircle className="animate-spin" size={15}/> : <ArrowRight size={15}/>} {state === 'creating' ? 'Creating…' : 'Open AI session'}</button></div></div>
        {message && <p role="status" className={`mt-3 text-sm ${state === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>{message}</p>}
        {session && state === 'success' && <Link href={`/workspace/sessions/${session.id}`} className="mt-3 block rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm hover:border-primary"><span className="font-medium">{session.title}</span><span className="mt-1 block text-xs text-muted-foreground">Pending AI work · Open session</span></Link>}
        {state === 'failed' && <button type="button" onClick={() => createSession()} className="mt-3 rounded-lg border px-3 py-2 text-sm hover:border-primary">Retry</button>}
        <div className="mt-5 grid gap-2 sm:grid-cols-2"><QuickAction href="/business-analyst" icon={<Zap size={15}/>} label="Ask the Business Analyst"/><QuickAction href="/brain" icon={<Brain size={15}/>} label="Ask Company Brain"/><QuickAction href="/studio" icon={<Film size={15}/>} label="Create Media"/><QuickAction href="/workflows" icon={<Workflow size={15}/>} label="Create Workflow"/></div>
      </Card>
      <Card><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">Workspace context</p><h2 className="mt-2 text-lg font-semibold">Your operating layer</h2></div><Sparkles size={18} className="text-primary"/></div>{error ? <p className="mt-6 text-sm text-destructive">{error.message}</p> : <div className="mt-6 grid grid-cols-2 gap-3">{[['Agents',data?.agents,'/agents'],['Workflows',data?.workflows,'/workflows'],['Knowledge',data?.knowledge,'/knowledge'],['Activity',data?.activity,'/activity']].map(([label,value,href]) => <Link key={String(label)} href={String(href)} className="rounded-xl border bg-muted/20 p-4 transition hover:border-primary"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{isLoading ? '—' : String(value ?? 0)}</p></Link>)}</div>}<p className="mt-6 text-sm leading-6 text-muted-foreground">Counts reflect organization-scoped records only.</p></Card>
    </div>
    <Card><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">Recent work</p><h2 className="mt-2 text-lg font-semibold">{data?.sessions?.length ? 'Reopen recent AI work' : 'Your AI work will appear here.'}</h2></div><Link href="/activity" className="flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium">View activity <ArrowRight size={15}/></Link></div>{data?.sessions?.length ? <div className="mt-5 divide-y">{data.sessions.map((item: Session) => <Link key={item.id} href={`/workspace/sessions/${item.id}`} className="flex flex-col gap-2 py-4 hover:text-primary sm:flex-row sm:items-center sm:justify-between"><span className="font-medium">{item.title}</span><span className="text-xs text-muted-foreground">{item.session_type} · {item.status} · {new Date(item.created_at).toLocaleString()}</span></Link>)}</div> : !isLoading && <p className="mt-2 text-sm text-muted-foreground">No real AI sessions or tasks have been created yet.</p>}</Card>
  </div>
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) { return <Link href={href} className="flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2.5 text-xs text-muted-foreground transition hover:border-primary hover:text-primary">{icon}{label}</Link> }
