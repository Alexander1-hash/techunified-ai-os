"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowRight, BadgeCheck, Building2, CircleAlert, CircleCheck, Clock3, ExternalLink, Globe2, Landmark, RefreshCw, Sparkles, WalletCards } from "lucide-react"

type Task = {
  id: string
  category: string
  title: string
  description: string | null
  status: "planned" | "in_progress" | "awaiting_payment" | "completed" | "blocked"
  metadata: { priority?: "high" | "medium" | "low" }
}

type Project = {
  id: string
  company_name: string | null
  business_idea: string
  jurisdiction: string | null
  stage: string
  progress: number
  metadata: { architect?: { industry?: string; business_model?: string; target_customer?: string; next_action?: string } }
}

type WorkspaceResponse = {
  project: Project | null
  agreement: { id: string; version: string; status: string; accepted_at: string | null } | null
  tasks: Task[]
}

const stageLabels: Record<string, string> = {
  idea: "Idea",
  agreement: "Agreement",
  identity: "Identity",
  formation: "Formation",
  infrastructure: "Infrastructure",
  launch: "Launch",
  completed: "Completed",
}

const statusLabels: Record<Task["status"], string> = {
  planned: "Planned",
  in_progress: "In progress",
  awaiting_payment: "Awaiting payment",
  completed: "Completed",
  blocked: "Blocked",
}

export default function CompanyCreationWorkspacePage() {
  const [data, setData] = useState<WorkspaceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function loadWorkspace() {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/company-creation/architect", { cache: "no-store" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "The workspace could not be loaded.")
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "The workspace could not be loaded.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadWorkspace()
  }, [])

  const project = data?.project
  const tasks = data?.tasks || []
  const completed = tasks.filter((task) => task.status === "completed").length
  const blocked = tasks.filter((task) => task.status === "blocked").length
  const nextTask = tasks.find((task) => task.status === "in_progress") || tasks.find((task) => task.status === "planned")
  const readiness = useMemo(() => {
    if (!project) return 0
    const taskScore = tasks.length ? Math.round((completed / tasks.length) * 100) : 0
    const agreementScore = data?.agreement?.status === "accepted" ? 100 : 0
    return Math.round(project.progress * 0.6 + taskScore * 0.25 + agreementScore * 0.15)
  }, [data?.agreement?.status, project, tasks.length, completed])

  if (loading) {
    return <main className="min-h-screen bg-background p-6 text-foreground"><div className="mx-auto max-w-6xl animate-pulse rounded-3xl border border-border/70 bg-card/60 p-8 text-sm text-muted-foreground">Loading your Company Creation workspace...</div></main>
  }

  if (error) {
    return <main className="min-h-screen bg-background p-6 text-foreground"><div className="mx-auto max-w-2xl rounded-3xl border border-red-400/30 bg-red-400/5 p-6"><CircleAlert className="h-5 w-5 text-red-400" /><p className="mt-3 text-sm">{error}</p><button onClick={() => void loadWorkspace()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white"><RefreshCw className="h-4 w-4" /> Retry</button></div></main>
  }

  if (!project) {
    return <main className="min-h-screen bg-background p-6 text-foreground"><div className="mx-auto max-w-2xl rounded-3xl border border-border bg-card/60 p-8"><Sparkles className="h-6 w-6 text-sky-400" /><h1 className="mt-4 text-2xl font-semibold">Your company workspace starts here.</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Start Company Creation first. Once your idea is analyzed, TechUnified will keep the project and its progress here.</p><a href="/company-creation" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white">Start Company Creation <ArrowRight className="h-4 w-4" /></a></div></main>
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium text-sky-400">Company Creation Workspace</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{project.company_name || "Unnamed company"}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{project.business_idea}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void loadWorkspace()} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium"><RefreshCw className="h-4 w-4" /> Refresh</button>
            <a href="/company-creation" className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white">Continue <ArrowRight className="h-4 w-4" /></a>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {[
            ["Stage", stageLabels[project.stage] || project.stage, Building2],
            ["Progress", `${project.progress}%`, BadgeCheck],
            ["Readiness", `${readiness}%`, Sparkles],
            ["Tasks", `${completed}/${tasks.length} done`, CircleCheck],
          ].map(([label, value, Icon]) => (
            <div key={label as string} className="rounded-2xl border border-border/70 bg-card/60 p-5">
              <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{label as string}</span><Icon className="h-4 w-4 text-sky-400" /></div>
              <div className="mt-2 text-2xl font-semibold">{value as string}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section className="rounded-3xl border border-border/70 bg-card/60 p-5 md:p-7">
            <div className="flex items-center justify-between"><div><h2 className="font-semibold">Company progress</h2><p className="mt-1 text-xs text-muted-foreground">TechUnified's current view of the build journey.</p></div><span className="text-sm font-semibold">{project.progress}%</span></div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-sky-500" style={{ width: `${project.progress}%` }} /></div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                [Building2, "Identity", project.stage === "identity" || ["formation","infrastructure","launch","completed"].includes(project.stage)],
                [Landmark, "Formation", ["formation","infrastructure","launch","completed"].includes(project.stage)],
                [Globe2, "Infrastructure", ["infrastructure","launch","completed"].includes(project.stage)],
              ].map(([Icon, label, complete]) => (
                <div key={label as string} className="rounded-2xl border border-border p-4"><Icon className="h-5 w-5 text-sky-400" /><div className="mt-3 text-sm font-medium">{label as string}</div><div className="mt-1 text-xs text-muted-foreground">{complete ? "Reached" : "Upcoming"}</div></div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-sky-400/20 bg-sky-400/5 p-5 md:p-7">
            <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-sky-400" /><h2 className="font-semibold">AI next action</h2></div>
            <p className="mt-4 text-sm leading-6">{project.metadata?.architect?.next_action || "Continue the Company Creation workflow to generate your next actions."}</p>
            {nextTask && <div className="mt-5 rounded-2xl border border-border/70 bg-background/40 p-4"><div className="text-xs text-muted-foreground">Recommended task</div><div className="mt-1 text-sm font-semibold">{nextTask.title}</div><div className="mt-1 text-xs leading-5 text-muted-foreground">{nextTask.description}</div></div>}
            {blocked > 0 && <div className="mt-4 text-xs text-amber-300">{blocked} task{blocked === 1 ? "" : "s"} currently blocked and may require your attention.</div>}
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section className="rounded-3xl border border-border/70 bg-card/60 p-5 md:p-7">
            <div className="flex items-center justify-between"><div><h2 className="font-semibold">Build tasks</h2><p className="mt-1 text-xs text-muted-foreground">A persistent checklist generated from your company plan.</p></div><WalletCards className="h-5 w-5 text-sky-400" /></div>
            <div className="mt-5 space-y-3">
              {tasks.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">No tasks have been generated yet.</div> : tasks.map((task) => (
                <div key={task.id} className="flex items-start gap-3 rounded-2xl border border-border p-4">
                  {task.status === "completed" ? <CircleCheck className="mt-0.5 h-5 w-5 text-emerald-400" /> : task.status === "blocked" ? <CircleAlert className="mt-0.5 h-5 w-5 text-amber-400" /> : <Clock3 className="mt-0.5 h-5 w-5 text-muted-foreground" />}
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{task.title}</span><span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">{statusLabels[task.status]}</span></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{task.description}</p></div>
                </div>
              ))}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-border/70 bg-card/60 p-5">
              <h2 className="font-semibold">Company intelligence</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Industry</span><span className="text-right font-medium">{project.metadata?.architect?.industry || "Not determined"}</span></div>
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Business model</span><span className="text-right font-medium">{project.metadata?.architect?.business_model || "Not determined"}</span></div>
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Jurisdiction</span><span className="text-right font-medium">{project.jurisdiction || "Not decided"}</span></div>
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Customer</span><span className="text-right font-medium">{project.metadata?.architect?.target_customer || "Not determined"}</span></div>
              </div>
            </div>
            <div className="rounded-3xl border border-border/70 bg-card/60 p-5">
              <h2 className="font-semibold">Commercial framework</h2>
              <div className="mt-4 rounded-2xl border border-border p-4"><div className="text-xs text-muted-foreground">Agreement</div><div className="mt-1 text-sm font-semibold">{data?.agreement?.status === "accepted" ? `v${data.agreement.version} recorded` : "Not accepted"}</div><p className="mt-2 text-xs leading-5 text-muted-foreground">Any equity arrangement remains subject to a separate legally valid agreement.</p></div>
            </div>
            <div className="rounded-3xl border border-border/70 bg-card/60 p-5">
              <h2 className="font-semibold">Coming next</h2>
              <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                {[[Globe2, "Infrastructure setup"], [WalletCards, "Verified services & payments"], [ExternalLink, "Company Brain connection"]].map(([Icon, label]) => <div key={label as string} className="flex items-center gap-3"><Icon className="h-4 w-4 text-sky-400" />{label as string}</div>)}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
