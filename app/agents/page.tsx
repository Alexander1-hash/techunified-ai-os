import Link from 'next/link'
import { Bot, Plus, ArrowRight, Activity } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { Card, PageHeader, Status } from '@/components/ui'

const agentSelect =
  'id, name, purpose, description, status, autonomy_level, model, last_activity_at, created_at, updated_at'

export default async function AgentsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.organization_id) {
    return (
      <main className="min-h-screen bg-background p-5 lg:p-8">
        <div className="mx-auto max-w-6xl">
          <PageHeader
            eyebrow="AI & Automation"
            title="AI Agents"
            subtitle="Your organization's AI workforce."
          />
          <Card>
            <p className="text-sm text-muted-foreground">
              Your account is not connected to an organization yet.
            </p>
          </Card>
        </div>
      </main>
    )
  }

  const { data: agents, error } = await supabase
    .from('agents')
    .select(agentSelect)
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <main className="min-h-screen bg-background p-5 lg:p-8">
        <div className="mx-auto max-w-6xl">
          <PageHeader
            eyebrow="AI & Automation"
            title="AI Agents"
            subtitle="Your organization's AI workforce."
          />
          <Card>
            <p className="text-sm text-destructive">
              Unable to load your AI agents right now.
            </p>
          </Card>
        </div>
      </main>
    )
  }

  const agentList = agents ?? []
  const activeAgents = agentList.filter(
    (agent) =>
      agent.status === 'active' ||
      agent.status === 'running',
  ).length

  return (
    <main className="min-h-screen bg-background p-5 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <PageHeader
            eyebrow="AI & Automation"
            title="AI Agents"
            subtitle="Manage and operate the intelligent workforce behind your company."
          />

          <Link
            href="/agents/new"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus size={16} />
            Create Agent
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Card>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bot size={20} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total agents</p>
                <p className="text-2xl font-semibold">{agentList.length}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Activity size={20} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active agents</p>
                <p className="text-2xl font-semibold">{activeAgents}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div>
              <p className="text-xs text-muted-foreground">Organization</p>
              <p className="mt-1 text-sm font-medium">Connected</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Agents are isolated to your organization.
              </p>
            </div>
          </Card>
        </div>

        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Your AI workforce</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Select an agent to open its workspace and send it a task.
            </p>
          </div>

          {agentList.length === 0 ? (
            <Card>
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bot size={24} />
                </div>

                <h3 className="mt-4 font-medium">
                  No AI agents yet
                </h3>

                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Create your first AI agent to start building your
                  organization's intelligent workforce.
                </p>

                <Link
                  href="/agents/new"
                  className="mt-5 inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
                >
                  <Plus size={16} />
                  Create your first agent
                </Link>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {agentList.map((agent) => (
                <Link
                  key={agent.id}
                  href={`/agents/${agent.id}`}
                  className="group"
                >
                  <Card className="h-full transition-colors group-hover:border-primary/40">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Bot size={22} />
                        </div>

                        <div className="min-w-0">
                          <h3 className="truncate font-semibold">
                            {agent.name}
                          </h3>

                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {agent.purpose ||
                              agent.description ||
                              'AI agent for your organization.'}
                          </p>
                        </div>
                      </div>

                      <ArrowRight
                        size={18}
                        className="mt-1 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground"
                      />
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-3 border-t pt-4">
                      <Status value={agent.status} />

                      {agent.model && (
                        <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
                          {agent.model}
                        </span>
                      )}

                      {agent.autonomy_level !== null &&
                        agent.autonomy_level !== undefined && (
                          <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
                            Autonomy {agent.autonomy_level}
                          </span>
                        )}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
    }
