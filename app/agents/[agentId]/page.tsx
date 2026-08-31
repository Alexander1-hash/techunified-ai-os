import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { agents } from '@/lib/data'
import { Card, PageHeader, Status } from '@/components/ui'
import { AgentWorkspaceClient } from './agent-workspace-client'

export default async function AgentWorkspace({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params
  const agent = agents.find((item) => item.id === agentId)
  if (!agent) notFound()

  return <main className="min-h-screen bg-background p-5 lg:p-8">
    <div className="mx-auto max-w-6xl">
      <Link href="/agents" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16} /> Back to AI Workforce</Link>
      <PageHeader eyebrow={agent.department} title={agent.name} subtitle={agent.purpose} />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <div><AgentWorkspaceClient agent={agent} /></div>
        <Card><h2 className="font-medium">Agent status</h2><div className="mt-4 flex items-center justify-between border-b pb-4"><span className="text-sm text-muted-foreground">Current status</span><Status value={agent.status} /></div><div className="flex items-center justify-between border-b py-4"><span className="text-sm text-muted-foreground">Model</span><span className="text-sm">{agent.model}</span></div><div className="flex items-center justify-between pt-4"><span className="text-sm text-muted-foreground">Recent activity</span><span className="text-sm">{agent.lastActivity}</span></div></Card>
      </div>
      <Card className="mt-6"><h2 className="font-medium">Recent activity</h2><p className="mt-4 text-sm text-muted-foreground">No execution history is available yet.</p></Card>
    </div>
  </main>
}
