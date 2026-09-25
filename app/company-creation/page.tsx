"use client"

import { useMemo, useState } from "react"
import { ArrowRight, BadgeCheck, Building2, ChevronLeft, CircleHelp, Globe2, Landmark, LockKeyhole, Sparkles, Store, WalletCards } from "lucide-react"

const steps = [
  { id: "idea", label: "Company idea", icon: Sparkles },
  { id: "agreement", label: "Agreement", icon: LockKeyhole },
  { id: "identity", label: "Identity", icon: Building2 },
  { id: "formation", label: "Formation", icon: Landmark },
  { id: "infrastructure", label: "Infrastructure", icon: Globe2 },
  { id: "launch", label: "Launch plan", icon: BadgeCheck },
]

export default function CompanyCreationPage() {
  const [step, setStep] = useState(0)
  const [idea, setIdea] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [jurisdiction, setJurisdiction] = useState("Nigeria")
  const [agreed, setAgreed] = useState(false)

  const progress = Math.round(((step + 1) / steps.length) * 100)
  const current = steps[step]

  const summary = useMemo(() => {
    if (!idea.trim()) return "Your company plan will appear here as you answer a few questions."
    return "TechUnified will organize a company creation plan around: " + idea.trim() + "."
  }, [idea])

  function next() {
    if (step === 1 && !agreed) return
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
                  TechUnified will turn your description into a structured company creation plan.
                </div>
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
                        This prototype records the commercial framework before company-creation services begin.
                        Any equity arrangement must be finalized in a legally valid agreement for the applicable jurisdiction.
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border p-3">
                      <div className="text-xs text-muted-foreground">Proposed TechUnified interest</div>
                      <div className="mt-1 font-semibold">5% equity — subject to final agreement</div>
                    </div>
                    <div className="rounded-xl border border-border p-3">
                      <div className="text-xs text-muted-foreground">Customer company</div>
                      <div className="mt-1 font-semibold">{companyName || "To be defined"}</div>
                    </div>
                  </div>
                </div>
                <label className="flex cursor-pointer gap-3 rounded-2xl border border-border p-4">
                  <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)}
                    className="mt-1 h-4 w-4 accent-sky-500" />
                  <span className="text-sm leading-6">
                    I understand the proposed commercial framework and want to continue to the company-creation setup.
                    I understand that this screen is not itself a substitute for a jurisdiction-specific legal agreement.
                  </span>
                </label>
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
              </div>
            )}

            {step === 3 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Business registration", "Identify the appropriate official formation route."],
                  ["Tax setup", "Identify relevant tax and reporting requirements."],
                  ["Business banking", "Prepare the information needed for a business account."],
                  ["Regulatory checks", "Surface industry-specific requirements before launch."],
                ].map(([title, text]) => (
                  <div key={title} className="rounded-2xl border border-border p-5">
                    <Landmark className="h-5 w-5 text-sky-400" />
                    <h3 className="mt-3 font-semibold">{title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
                  </div>
                ))}
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
                  <h3 className="mt-3 text-lg font-semibold">Your creation plan is ready.</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Next, TechUnified can connect the plan to real service providers, payments, company data, and the Company Brain.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ["Company", companyName || "Name pending"],
                    ["Jurisdiction", jurisdiction],
                    ["Framework", "Agreement recorded"],
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
              <button onClick={() => setStep((value) => Math.max(value - 1, 0))} disabled={step === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
              {step < steps.length - 1 && (
                <button onClick={next} disabled={(step === 0 && !idea.trim()) || (step === 1 && !agreed)}
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40">
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-border/70 bg-card/60 p-5">
              <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-sky-400" /><span className="text-sm font-semibold">Company Architect</span></div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{summary}</p>
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
