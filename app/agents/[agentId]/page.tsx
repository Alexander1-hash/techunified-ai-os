import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Bot, Play } from 'lucide-react'
import { agents } from '@/lib/data'
import { Card, PageHeader, Status } from '@/components/ui'

export default async function AgentWorkspace({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params
  const agent = agents.find((item) => item.id === agentId)
  if (!agent) notFound()

  return <main className="min-h-screen bg-background p-5 lg:p-8">
    <div className="mx-auto max-w-6xl">
      <Link href="/agents" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16} /> Back to AI Workforce</Link>
      <PageHeader eyebrow={agent.department} title={agent.name} subtitle={agent.purpose} action={<button type="button" disabled className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"><Play size={16} /> Run agent</button>} />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <Card><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Bot size={20} /></div><div><h2 className="font-medium">Task input</h2><p className="text-xs text-muted-foreground">Agent execution is not configured.</p></div></div><textarea className="mt-5 min-h-36 w-full resize-y rounded-lg border bg-muted/30 p-3 text-sm outline-none focus:border-primary" placeholder="Describe a task for this agent..." /><p className="mt-3 text-sm text-muted-foreground">Connect an AI provider before running this agent. No result will be fabricated.</p></Card>
        <Card><h2 className="font-medium">Agent status</h2><div className="mt-4 flex items-center justify-between border-b pb-4"><span className="text-sm text-muted-foreground">Current status</span><Status value={agent.status} /></div><div className="flex items-center justify-between border-b py-4"><span className="text-sm text-muted-foreground">Model</span><span className="text-sm">{agent.model}</span></div><div className="flex items-center justify-between pt-4"><span className="text-sm text-muted-foreground">Recent activity</span><span className="text-sm">{agent.lastActivity}</span></div></Card>
      </div>
      <Card className="mt-6"><h2 className="font-medium">Recent activity</h2><p className="mt-4 text-sm text-muted-foreground">No execution history is available yet.</p></Card>
    </div>
  </main>
}
