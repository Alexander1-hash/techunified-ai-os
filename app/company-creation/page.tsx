"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowRight, BadgeCheck, Building2, ChevronLeft, CircleHelp, Globe2, Landmark, LockKeyhole, Sparkles, Store, WalletCards } from "lucide-react"

const steps = [
  { id: "idea", label: "Company idea", icon: Sparkles },
  { id: "agreement", label: "Agreement", icon: LockKeyhole },
  { id: "identity", label: "Identity", icon: Building2 },
  { id: "formation", label: "Formation", icon: Landmark },
  { id: "infrastructure", label: "Infrastructure", icon: Globe2 },
  { id: "launch", label: "Launch plan", icon: BadgeCheck },
]

type Architect = {
  company_summary: string
  industry: string
  business_model: string
  target_customer: string
  key_assumptions: string[]
  missing_information: Array<{ question: string; why_it_matters: string }>
  roadmap: Array<{ category: string; title: string; description: string; priority: "high" | "medium" | "low" }>
  next_action: string
}

export default function CompanyCreationPage() {
  const [step, setStep] = useState(0)
  const [idea, setIdea] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [jurisdiction, setJurisdiction] = useState("Nigeria")
  const [agreed, setAgreed] = useState(false)
  const [architect, setArchitect] = useState<Architect | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [loadingArchitect, setLoadingArchitect] = useState(false)
  const [savingAgreement, setSavingAgreement] = useState(false)
  const [agreementId, setAgreementId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [loadingWorkspace, setLoadingWorkspace] = useState(true)
  const [identity, setIdentity] = useState<{ proposed_name: string | null; domain_candidates: string[]; social_handles: string[]; verification_status: string; metadata?: { rationale?: string; verification_note?: string } } | null>(null)
  const [loadingIdentity, setLoadingIdentity] = useState(false)
  const [loadingVerification, setLoadingVerification] = useState(false)
  const [formation, setFormation] = useState<any>(null)
  const [loadingFormation, setLoadingFormation] = useState(false)

  useEffect(() => {
    let active = true

    async function resumeWorkspace() {
      try {
        const response = await fetch("/api/company-creation/architect", { cache: "no-store" })
        const data = await response.json()
        if (!active || !response.ok || !data.project) return

        const savedArchitect = data.project.metadata?.architect as Architect | undefined
        setProjectId(data.project.id)
        setCompanyName(data.project.company_name || "")
        setIdea(data.project.business_idea || "")
        setJurisdiction(data.project.jurisdiction || "Nigeria")
        if (savedArchitect) setArchitect(savedArchitect)
        const formationResponse = await fetch(`/api/company-creation/formation?projectId=${encodeURIComponent(data.project.id)}`, { cache: "no-store" })
        if (formationResponse.ok) { const formationData = await formationResponse.json(); if (active && formationData.assessment) setFormation(formationData.assessment) }
        if (data.project.id) {
          const identityResponse = await fetch(`/api/company-creation/identity?projectId=${encodeURIComponent(data.project.id)}`, { cache: "no-store" })
          if (identityResponse.ok) {
            const identityData = await identityResponse.json()
            if (active && identityData.identity) setIdentity(identityData.identity)
          }
        }
        if (data.agreement?.status === "accepted") {
          setAgreed(true)
          setAgreementId(data.agreement.id)
        }

        const stageToStep: Record<string, number> = {
          idea: 0,
          agreement: 1,
          identity: 2,
          formation: 3,
          infrastructure: 4,
          launch: 5,
          completed: 5,
        }
        setStep(stageToStep[data.project.stage] ?? 0)
      } catch {
        // A resume failure should not block starting a new company creation project.
      } finally {
        if (active) setLoadingWorkspace(false)
      }
    }

    void resumeWorkspace()
    return () => { active = false }
  }, [])

  const progress = architect ? Math.max(10, Math.round(((step + 1) / steps.length) * 100)) : Math.round(((step + 1) / steps.length) * 100)
  const current = steps[step]

  const summary = useMemo(() => {
    if (loadingArchitect) return "Company Architect is analyzing your idea and designing the first company-building plan."
    if (architect) return architect.company_summary
    if (!idea.trim()) return "Describe what you want to build. The Architect will identify the company structure, missing information, and next actions."
    return "Your idea is ready for analysis. TechUnified will turn it into a structured company creation plan."
  }, [architect, idea, loadingArchitect])

  async function analyzeIdea() {
    setError("")
    setLoadingArchitect(true)
    try {
      const response = await fetch("/api/company-creation/architect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, companyName, jurisdiction, projectId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "The Company Architect could not analyze this idea.")
      setArchitect(data.architect)
      setProjectId(data.project?.id || null)
      setStep(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoadingArchitect(false)
    }
  }

  async function generateIdentity() {
    if (!projectId || loadingIdentity) return
    setError("")
    setLoadingIdentity(true)
    try {
      const response = await fetch("/api/company-creation/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, companyName }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Identity intelligence could not be generated.")
      setIdentity(data.identity)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Identity intelligence could not be generated.")
    } finally {
      setLoadingIdentity(false)
    }
  }

  async function generateFormation() {
    if (!projectId || loadingFormation) return
    setError("")
    setLoadingFormation(true)
    try {
      const response = await fetch("/api/company-creation/formation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Formation intelligence could not be generated.")
      setFormation(data.assessment)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Formation intelligence could not be generated.")
    } finally { setLoadingFormation(false) }
  }

  async function verifyIdentity() {
    if (!projectId || loadingVerification) return
    setError("")
    setLoadingVerification(true)
    try {
      const response = await fetch("/api/company-creation/identity/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Identity verification could not be completed.")
      setIdentity(data.identity)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Identity verification could not be completed.")
    } finally {
      setLoadingVerification(false)
    }
  }

  async function acceptAgreement() {
    if (!projectId || !agreed || savingAgreement) return

    setError("")
    setSavingAgreement(true)

    try {
      const response = await fetch("/api/company-creation/agreement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Your agreement acceptance could not be saved.")
      }

      setAgreementId(data.agreement?.id || null)
      setStep(2)

      if (data.warning) {
        setError(data.warning)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your agreement acceptance could not be saved.")
    } finally {
      setSavingAgreement(false)
    }
  }

  function next() {
    if (step === 0) {
      void analyzeIdea()
      return
    }
    if (step === 1) {
      void acceptAgreement()
      return
    }
    setStep((value) => Math.min(value + 1, steps.length - 1))
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-sky-400">TechUnified Company Creation</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Turn an idea into a company.</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              One intelligent workflow for company identity, formation, digital infrastructure, services, and launch planning.
            </p>
          </div>
          <div className="hidden rounded-2xl border border-border/70 bg-card/60 px-4 py-3 text-right md:block">
            <div className="text-xs text-muted-foreground">Creation progress</div>
            <div className="text-xl font-semibold">{progress}%</div>
          </div>
        </div>

        <div className="mb-8 overflow-x-auto">
          <div className="flex min-w-max items-center gap-2">
            {steps.map((item, index) => {
              const Icon = item.icon
              const active = index === step
              const complete = index < step
              return (
                <div key={item.id} className="flex items-center gap-2">
                  <div className={[
                    "flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium",
                    active ? "border-sky-400/60 bg-sky-400/10 text-sky-300" :
                    complete ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" :
                    "border-border bg-card text-muted-foreground"
                  ].join(" ")}>
                    {complete ? <BadgeCheck className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                    {item.label}
                  </div>
                  {index < steps.length - 1 && <div className="h-px w-5 bg-border" />}
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <section className="rounded-3xl border border-border/70 bg-card/70 p-5 shadow-2xl shadow-black/10 md:p-8">
            <div className="mb-7">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-400">Step {step + 1} of {steps.length}</p>
              <h2 className="mt-2 text-xl font-semibold">{current.label}</h2>
            </div>

            {step === 0 && (
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-medium">What are you building?</label>
                  <textarea value={idea} onChange={(event) => setIdea(event.target.value)}
                    placeholder="Example: I want to build an African fashion company selling online worldwide."
                    className="mt-2 min-h-36 w-full resize-none rounded-2xl border border-border bg-background/70 p-4 text-sm outline-none placeholder:text-muted-foreground focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/10" />
                </div>
                <div className="rounded-2xl border border-sky-400/20 bg-sky-400/5 p-4 text-sm text-muted-foreground">
                  <Sparkles className="mb-2 h-5 w-5 text-sky-400" />
                  The Company Architect will analyze your idea, identify missing information, and generate a tailored company-building roadmap.
                </div>
                {error && <div className="rounded-2xl border border-red-400/30 bg-red-400/5 p-4 text-sm text-red-300">{error}</div>}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-border bg-background/50 p-5">
                  <div className="flex items-start gap-3">
                    <LockKeyhole className="mt-0.5 h-5 w-5 text-sky-400" />
                    <div>
                      <h3 className="font-semibold">Company Creation Agreement</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        This presents the proposed commercial framework before company-creation services begin. Any equity arrangement must be finalized in a legally valid agreement for the applicable jurisdiction.
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border p-3">
                      <div className="text-xs text-muted-foreground">Proposed TechUnified interest</div>
                      <div className="mt-1 font-semibold">5% equity — subject to final agreement</div>
                    </div>
                    <div className="rounded-xl border border-border p-3">
                      <div className="text-xs text-muted-foreground">Company Architect</div>
                      <div className="mt-1 font-semibold">{architect?.industry || "Analyzing business type"}</div>
                    </div>
                  </div>
                </div>
                <label className="flex cursor-pointer gap-3 rounded-2xl border border-border p-4">
                  <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)}
                    className="mt-1 h-4 w-4 accent-sky-500" />
                  <span className="text-sm leading-6">
                    I understand the proposed commercial framework and want to continue. I understand that this screen is not itself a substitute for a jurisdiction-specific legal agreement. My acceptance will be securely recorded against this Company Creation project.
                  </span>
                </label>
                {agreementId && (
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-300">
                    Agreement v1.0 accepted and securely recorded for this Company Creation project.
                  </div>
                )}
                {error && <div className="rounded-2xl border border-red-400/30 bg-red-400/5 p-4 text-sm text-red-300">{error}</div>}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-medium">Company / trading name</label>
                  <input value={companyName} onChange={(event) => setCompanyName(event.target.value)}
                    placeholder="Example: Lagos Streetwear"
                    className="mt-2 w-full rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm outline-none focus:border-sky-400/60" />
                </div>
                <div>
                  <label className="text-sm font-medium">Primary jurisdiction</label>
                  <select value={jurisdiction} onChange={(event) => setJurisdiction(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm outline-none focus:border-sky-400/60">
                    <option>Nigeria</option><option>United States</option><option>United Kingdom</option><option>Other / decide later</option>
                  </select>
                </div>

                <div className="rounded-2xl border border-sky-400/20 bg-sky-400/5 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">Identity & Availability Intelligence</div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">Generate company names, domains, and social-handle candidates. These are suggestions until checked through the relevant provider or official registry.</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button onClick={() => void generateIdentity()} disabled={loadingIdentity || loadingVerification || !projectId}
                        className="rounded-xl border border-border px-3 py-2 text-xs font-semibold disabled:opacity-40">
                        {loadingIdentity ? "Generating..." : identity ? "Regenerate" : "Generate"}
                      </button>
                      {identity && (
                        <button onClick={() => void verifyIdentity()} disabled={loadingVerification || loadingIdentity}
                          className="rounded-xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">
                          {loadingVerification ? "Checking..." : "Verify"}
                        </button>
                      )}
                    </div>
                  </div>

                  {identity && (
                    <div className="mt-5 space-y-4">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Suggested primary name</div>
                        <div className="mt-2 rounded-xl border border-border bg-background/50 p-3 text-sm font-medium">{identity.proposed_name || "No name generated"}</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Domain candidates</div>
                        <div className="mt-2 flex flex-wrap gap-2">{identity.domain_candidates.map((domain) => {
                          const checks = (identity.metadata as any)?.verification?.domain_checks as Array<{ domain: string; status: string }> | undefined
                          const check = checks?.find((item) => item.domain === domain.toLowerCase())
                          const label = check?.status === "not_found" ? "not registered" : check?.status === "registered" ? "registered" : check?.status === "unknown" ? "unknown" : "not checked"
                          return <span key={domain} className="rounded-xl border border-border bg-background/50 px-3 py-2 text-xs"><span className="font-medium">{domain}</span><span className="ml-2 text-muted-foreground">{label}</span></span>
                        })}</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Social handle candidates</div>
                        <div className="mt-2 flex flex-wrap gap-2">{identity.social_handles.map((handle) => <span key={handle} className="rounded-full border border-border bg-background/50 px-3 py-1.5 text-xs">@{handle.replace(/^@/, "")}</span>)}</div>
                      </div>
                      <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-5 text-amber-200">
                        <div className="font-medium">Verification status: {identity.verification_status === "needs_provider_check" ? "Some checks require a provider" : identity.verification_status === "verified_available" ? "A domain candidate was not found in RDAP" : identity.verification_status === "verified_unavailable" ? "Domain candidates were found registered" : identity.verification_status}</div>
                        <div className="mt-1">{identity.metadata?.verification_note || "Availability has not been verified."}</div>
                      </div>
                    </div>
                  )}
                </div>

                {architect?.missing_information?.length ? (
                  <div className="rounded-2xl border border-sky-400/20 bg-sky-400/5 p-4">
                    <div className="font-semibold">The Architect needs a little more information</div>
                    <div className="mt-3 space-y-3">
                      {architect.missing_information.slice(0, 4).map((item) => (
                        <div key={item.question} className="rounded-xl border border-border/70 p-3">
                          <div className="text-sm font-medium">{item.question}</div>
                          <div className="mt-1 text-xs leading-5 text-muted-foreground">{item.why_it_matters}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-sky-400/20 bg-sky-400/5 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div><div className="font-semibold">Formation Intelligence Center</div><p className="mt-1 text-xs leading-5 text-muted-foreground">Turn your company plan into a formation checklist. TechUnified does not file or provide legal/tax advice.</p></div>
                    <button onClick={() => void generateFormation()} disabled={loadingFormation || !projectId} className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">{loadingFormation ? "Building..." : formation ? "Refresh" : "Build checklist"}</button>
                  </div>
                </div>
                {formation && <div className="space-y-3">
                  <div className="rounded-2xl border border-border p-4"><div className="text-xs text-muted-foreground">Formation path</div><div className="mt-1 font-semibold">{formation.entity_path}</div></div>
                  {(formation.checklist || []).map((item: any) => <div key={item.title} className="rounded-2xl border border-border p-4"><div className="flex items-center gap-2"><Landmark className="h-4 w-4 text-sky-400" /><div className="font-medium">{item.title}</div><span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">{item.status.replace("_"," ")}</span></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{item.detail}</p></div>)}
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs leading-5 text-amber-200">Planning only. Confirm current CAC requirements, fees and applicable professional advice before submission.</div>
                </div>}
                {architect?.roadmap?.length ? (
                  <div className="rounded-2xl border border-border p-5">
                    <div className="font-semibold">Architect roadmap</div>
                    <div className="mt-3 space-y-3">
                      {architect.roadmap.map((item) => (
                        <div key={item.title} className="flex gap-3 rounded-xl border border-border/70 p-3">
                          <BadgeCheck className="mt-0.5 h-4 w-4 text-sky-400" />
                          <div><div className="text-sm font-medium">{item.title}</div><div className="text-xs leading-5 text-muted-foreground">{item.description}</div></div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {step === 4 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Domain", "Find and secure the company's digital address."],
                  ["Business email", "Create a professional communication layer."],
                  ["Brand identity", "Build a consistent visual identity."],
                  ["Social presence", "Check relevant social handles and launch assets."],
                ].map(([title, text]) => (
                  <div key={title} className="rounded-2xl border border-border p-5">
                    <Globe2 className="h-5 w-5 text-sky-400" />
                    <h3 className="mt-3 font-semibold">{title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
                  </div>
                ))}
              </div>
            )}

            {step === 5 && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5">
                  <BadgeCheck className="h-6 w-6 text-emerald-400" />
                  <h3 className="mt-3 text-lg font-semibold">Your first company blueprint is ready.</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {architect?.next_action || "The next phase connects your plan to verified services, payments, company data, and the Company Brain."}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ["Company", companyName || "Name pending"],
                    ["Jurisdiction", jurisdiction],
                    ["Project", projectId ? "Saved to workspace" : "Not saved"],
                    ["Agreement", agreementId ? "v1.0 recorded" : "Not accepted"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-border p-4">
                      <div className="text-xs text-muted-foreground">{label}</div>
                      <div className="mt-1 text-sm font-semibold">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-5">
              <button onClick={() => setStep((value) => Math.max(value - 1, 0))} disabled={step === 0 || loadingWorkspace || loadingArchitect}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
              {step < steps.length - 1 && (
                <button onClick={next} disabled={loadingWorkspace || loadingArchitect || savingAgreement || (step === 0 && idea.trim().length < 20) || (step === 1 && !agreed)}
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40">
                  {loadingWorkspace ? "Loading workspace..." : loadingArchitect ? "Architect is thinking..." : savingAgreement ? "Saving agreement..." : "Continue"} <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-border/70 bg-card/60 p-5">
              <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-sky-400" /><span className="text-sm font-semibold">Company Architect</span></div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{summary}</p>
              {architect && (
                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Business model</span><span className="text-right font-medium">{architect.business_model}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Customer</span><span className="text-right font-medium">{architect.target_customer}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Missing answers</span><span className="font-medium">{architect.missing_information.length}</span></div>
                </div>
              )}
            </div>
            <div className="rounded-3xl border border-border/70 bg-card/60 p-5">
              <div className="text-sm font-semibold">What TechUnified will organize</div>
              <div className="mt-4 space-y-3">
                {[[Store, "Company identity"], [Landmark, "Formation & compliance"], [Globe2, "Digital infrastructure"], [WalletCards, "Services & payments"]].map(([Icon, label]) => (
                  <div key={label as string} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <div className="rounded-lg border border-border p-2"><Icon className="h-4 w-4" /></div>{label as string}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card/40 p-4 text-xs leading-5 text-muted-foreground">
              <CircleHelp className="mb-2 h-4 w-4" />
              TechUnified coordinates information and services. Government registrations, regulated services, payments, and legal documents should use authorized providers and official channels.
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
