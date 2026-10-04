import { createClient } from '@/lib/supabase/server'
import { Card, PageHeader, Status } from '@/components/ui'
import OrchestrationConsole from '@/components/orchestration-console'

export default async function OrchestrationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.organization_id) {
    return (
      <main className="min-h-screen bg-background p-5 lg:p-8">
        <div className="mx-auto max-w-6xl">
          <PageHeader eyebrow="AI Operations" title="Orchestration" subtitle="Coordinate company objectives, governed AI workers, workflows, evidence, and outcomes." />
          <Card><p className="text-sm text-muted-foreground">Your account is not connected to an organization yet.</p></Card>
        </div>
      </main>
    )
  }

  const [{ data: objectives, error: objectivesError }, { data: runs, error: runsError }] = await Promise.all([
    supabase
      .from('company_objectives')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('business_orchestration_runs')
      .select('id,objective_id,lead_agent_id,status,approval_status,plan,evidence,result,error_message,created_at,updated_at')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (objectivesError || runsError) {
    return (
      <main className="min-h-screen bg-background p-5 lg:p-8">
        <div className="mx-auto max-w-6xl">
          <PageHeader eyebrow="AI Operations" title="Orchestration" subtitle="Coordinate company objectives, governed AI workers, workflows, evidence, and outcomes." />
          <Card><p className="text-sm text-destructive">{objectivesError?.message || runsError?.message || 'Unable to load orchestration data.'}</p></Card>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background p-5 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="AI Operations"
          title="Orchestration"
          subtitle="Turn company objectives into governed, measurable work without bypassing human controls."
        />
        <div className="mt-8">
          <OrchestrationConsole
            objectives={objectives ?? []}
            initialRuns={runs ?? []}
          />
        </div>
      </div>
    </main>
  )
}
