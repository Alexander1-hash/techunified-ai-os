import Link from 'next/link'
import {
  ArrowRight,
  GitBranch,
  Plus,
  Workflow,
} from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { Card, PageHeader, Status } from '@/components/ui'

const workflowSelect =
  'id, name, description, status, configuration, created_at, updated_at'

export default async function WorkflowsPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    return (
      <main className="min-h-screen bg-background p-5 lg:p-8">
        <div className="mx-auto max-w-6xl">
          <PageHeader
            eyebrow="AI & Automation"
            title="Workflows"
            subtitle="Build and manage automated business processes."
          />
          <Card>
            <p className="text-sm text-destructive">
              Authentication error: {authError.message}
            </p>
          </Card>
        </div>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-background p-5 lg:p-8">
        <div className="mx-auto max-w-6xl">
          <PageHeader
            eyebrow="AI & Automation"
            title="Workflows"
            subtitle="Build and manage automated business processes."
          />
          <Card>
            <p className="text-sm text-destructive">
              No authenticated user session was found.
            </p>
          </Card>
        </div>
      </main>
    )
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    return (
      <main className="min-h-screen bg-background p-5 lg:p-8">
        <div className="mx-auto max-w-6xl">
          <PageHeader
            eyebrow="AI & Automation"
            title="Workflows"
            subtitle="Build and manage automated business processes."
          />
          <Card>
            <p className="text-sm text-destructive">
              Profile query error: {profileError.message}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Code: {profileError.code || 'unknown'}
            </p>
          </Card>
        </div>
      </main>
    )
  }

  if (!profile?.organization_id) {
    return (
      <main className="min-h-screen bg-background p-5 lg:p-8">
        <div className="mx-auto max-w-6xl">
          <PageHeader
            eyebrow="AI & Automation"
            title="Workflows"
            subtitle="Build and manage automated business processes."
          />
          <Card>
            <p className="text-sm text-destructive">
              Your profile does not have an organization_id.
            </p>
          </Card>
        </div>
      </main>
    )
  }

  const {
    data: workflows,
    error: workflowError,
  } = await supabase
    .from('workflows')
    .select(workflowSelect)
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })

  if (workflowError) {
    return (
      <main className="min-h-screen bg-background p-5 lg:p-8">
        <div className="mx-auto max-w-6xl">
          <PageHeader
            eyebrow="AI & Automation"
            title="Workflows"
            subtitle="Build and manage automated business processes."
          />
          <Card>
            <p className="text-sm font-medium text-destructive">
              Workflow database error
            </p>

            <div className="mt-3 space-y-1 rounded-lg border bg-muted/30 p-4 text-xs">
              <p>
                <strong>Message:</strong> {workflowError.message}
              </p>
              <p>
                <strong>Code:</strong>{' '}
                {workflowError.code || 'unknown'}
              </p>
              <p>
                <strong>Details:</strong>{' '}
                {workflowError.details || 'none'}
              </p>
              <p>
                <strong>Hint:</strong>{' '}
                {workflowError.hint || 'none'}
              </p>
            </div>
          </Card>
        </div>
      </main>
    )
  }

  const workflowList = workflows ?? []

  const activeWorkflows = workflowList.filter(
    (workflow) =>
      workflow.status === 'active' ||
      workflow.status === 'running' ||
      workflow.status === 'enabled',
  ).length

  const draftWorkflows = workflowList.filter(
    (workflow) =>
      workflow.status === 'draft' ||
      workflow.status === 'inactive',
  ).length

  return (
    <main className="min-h-screen bg-background p-5 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <PageHeader
            eyebrow="AI & Automation"
            title="Workflows"
            subtitle="Design and manage the automated processes that run your company."
          />

          <Link
            href="/workflows/new"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus size={16} />
            Create Workflow
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Card>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Workflow size={20} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Total workflows
                </p>
                <p className="text-2xl font-semibold">
                  {workflowList.length}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <GitBranch size={20} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Active workflows
                </p>
                <p className="text-2xl font-semibold">
                  {activeWorkflows}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <p className="text-xs text-muted-foreground">
              Draft workflows
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {draftWorkflows}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ready to be configured and activated.
            </p>
          </Card>
        </div>

        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">
              Your workflows
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage the automated processes connected to your organization.
            </p>
          </div>

          {workflowList.length === 0 ? (
            <Card>
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Workflow size={24} />
                </div>

                <h3 className="mt-4 font-medium">
                  No workflows yet
                </h3>

                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Create your first workflow to start automating business
                  processes.
                </p>

                <Link
                  href="/workflows/new"
                  className="mt-5 inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
                >
                  <Plus size={16} />
                  Create your first workflow
                </Link>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {workflowList.map((workflow) => (
                <Link
                  key={workflow.id}
                  href={`/workflows/${workflow.id}`}
                  className="group"
                >
                  <Card className="h-full transition-colors group-hover:border-primary/40">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Workflow size={22} />
                        </div>

                        <div className="min-w-0">
                          <h3 className="truncate font-semibold">
                            {workflow.name}
                          </h3>

                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {workflow.description ||
                              'Automated business workflow.'}
                          </p>
                        </div>
                      </div>

                      <ArrowRight
                        size={18}
                        className="mt-1 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground"
                      />
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-3 border-t pt-4">
                      <Status value={workflow.status} />

                      <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
                        Created{' '}
                        {new Date(
                          workflow.created_at,
                        ).toLocaleDateString()}
                      </span>
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
