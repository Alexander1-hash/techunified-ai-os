'use client'

import { FormEvent, useState } from 'react'
import { Bot, Play } from 'lucide-react'
import { Card, Status } from '@/components/ui'
import type { Agent } from '@/lib/data'

type Turn = { role: 'user' | 'agent'; content: string }

export function AgentWorkspaceClient({ agent }: { agent: Agent }) {
  const [message, setMessage] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function runAgent(event: FormEvent) {
    event.preventDefault()
    const task = message.trim()
    if (!task || busy) return
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await fetch(`/api/agents/${agent.id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: task }) })
      const body = await result.json()
      if (!result.ok) throw new Error(body.error || 'The agent could not complete that task.')
      setTurns((current) => [...current, { role: 'user', content: task }, { role: 'agent', content: body.response }])
    } catch (caught) { setMessage(task); setError(caught instanceof Error ? caught.message : 'The agent could not complete that task. Please try again.') }
    finally { setBusy(false) }
  }

  return <>
    <Card><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Bot size={20} /></div><div><h2 className="font-medium">Task input</h2><p className="text-xs text-muted-foreground">Send a task to this agent through the secure server API.</p></div></div><form onSubmit={runAgent}><textarea value={message} onChange={(event) => setMessage(event.target.value)} disabled={busy} className="mt-5 min-h-36 w-full resize-y rounded-lg border bg-muted/30 p-3 text-sm outline-none focus:border-primary disabled:opacity-60" placeholder="Describe a task for this agent..." aria-label="Agent task" /><button type="submit" disabled={busy || !message.trim()} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"><Play size={16} />{busy ? 'Agent is thinking...' : 'Run agent'}</button></form>{error&&<p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}</Card>
    <Card className="mt-6"><h2 className="font-medium">Conversation</h2>{turns.length===0?<p className="mt-4 text-sm text-muted-foreground">Give your agent a task to get started.</p>:<div className="mt-4 flex flex-col gap-4">{turns.map((turn,index)=><div key={`${turn.role}-${index}`} className="rounded-lg border p-4"><p className="text-xs font-medium uppercase tracking-wide text-primary">{turn.role==='user'?'You':agent.name}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{turn.content}</p></div>)}</div>}</Card>
  </>
}
