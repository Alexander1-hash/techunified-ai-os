'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Plus, Workflow } from 'lucide-react'
import Link from 'next/link'

import { createClient } from '@/lib/supabase/client'
import { Card, PageHeader } from '@/components/ui'

export default function NewWorkflowPage() {
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedName = name.trim()
    const trimmedDescription = description.trim()

    if (!trimmedName) {
      setError('Workflow name is required.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) {
        throw new Error(authError.message)
      }

      if (!user) {
        throw new Error('Your session has expired. Please sign in again.')
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        throw new Error(profileError.message)
      }

      if (!profile?.organization_id) {
        throw new Error(
          'Your account is not connected to an organization yet.',
        )
      }

      const { data: workflow, error: workflowError } = await supabase
        .from('workflows')
        .insert({
          organization_id: profile.organization_id,
          name: trimmedName,
          description: trimmedDescription,
          status: 'draft',
        })
        .select('id')
        .single()

      if (workflowError) {
        throw new Error(workflowError.message)
      }

      router.push(`/workflows/${workflow.id}`)
      router.refresh()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to create workflow.',
      )
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-background p-5 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Link
            href="/workflows"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={16} />
            Back to Workflows
          </Link>
        </div>

        <PageHeader
          eyebrow="AI & Automation"
          title="Create Workflow"
          subtitle="Define a business process that can later be connected to triggers, actions, and automation services."
        />

        <div className="mt-8">
          <Card>
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Workflow size={24} />
              </div>

              <div>
                <h2 className="font-semibold">
                  Workflow details
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Start with the basic information. The workflow will be
                  created as a draft.
                </p>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="mt-8 space-y-6"
            >
              <div>
                <label
                  htmlFor="workflow-name"
                  className="mb-2 block text-sm font-medium"
                >
                  Workflow name
                </label>

                <input
                  id="workflow-name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. New Customer Follow-up"
                  disabled={saving}
                  className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <div>
                <label
                  htmlFor="workflow-description"
                  className="mb-2 block text-sm font-medium"
                >
                  Description
                </label>

                <textarea
                  id="workflow-description"
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  placeholder="Describe what this workflow is supposed to automate..."
                  rows={5}
                  disabled={saving}
                  className="w-full resize-none rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              {error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <p className="text-sm text-destructive">
                    {error}
                  </p>
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Link
                  href="/workflows"
                  className="inline-flex items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Cancel
                </Link>

                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2
                        size={16}
                        className="animate-spin"
                      />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Create Workflow
                    </>
                  )}
                </button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </main>
  )
             }
