'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, Brain, CheckCircle2, Compass, Sparkles, X } from 'lucide-react'

const STORAGE_KEY = 'techunifedaios-onboarding-dismissed-v1'

const steps = [
  { number: '01', title: 'Connect your company knowledge', description: 'Start with a file or data source so your workspace can be grounded in your own business information.', href: '/brain/data-sources', action: 'Add knowledge', icon: Brain },
  { number: '02', title: 'Try one small AI task', description: 'Start with a clear prompt, review the result, and refine it before relying on it for business decisions.', href: '/studio', action: 'Open AI Studio', icon: Sparkles },
  { number: '03', title: 'Review before you automate', description: 'Explore agents and workflows when you know the process. Keep approvals and human checks in place.', href: '/workflows', action: 'Explore workflows', icon: CheckCircle2 },
]

export function FirstRunGuide() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try { setVisible(window.localStorage.getItem(STORAGE_KEY) !== 'dismissed') }
    catch { setVisible(true) }
  }, [])

  function dismiss() {
    setVisible(false)
    try { window.localStorage.setItem(STORAGE_KEY, 'dismissed') } catch { /* Current-view dismissal still works. */ }
  }

  if (!visible) return null

  return (
    <section aria-labelledby="getting-started-title" className="min-w-0 overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.09] via-card to-card p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Compass size={20} aria-hidden="true" /></div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-primary">Your first 5 minutes</p>
            <h2 id="getting-started-title" className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">Start with one useful task</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">You do not need to set everything up today. Follow these steps in order, and keep a human in control of important decisions.</p>
          </div>
        </div>
        <button type="button" onClick={dismiss} aria-label="Dismiss getting started guide" className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X size={18} /></button>
      </div>
      <div className="mt-5 grid min-w-0 gap-3 md:grid-cols-3">
        {steps.map((step) => {
          const Icon = step.icon
          return (
            <article key={step.number} className="flex min-w-0 flex-col rounded-xl border border-border/80 bg-background/80 p-4">
              <div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold tracking-[.12em] text-primary">{step.number}</span><Icon size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" /></div>
              <h3 className="mt-3 text-sm font-semibold leading-5">{step.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{step.description}</p>
              <Link href={step.href} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-lg border border-border px-3 text-sm font-semibold transition hover:border-primary/50 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{step.action}<ArrowRight size={15} aria-hidden="true" /></Link>
            </article>
          )
        })}
      </div>
      <p className="mt-4 text-xs leading-5 text-muted-foreground">This guide stays hidden on this browser after you dismiss it.</p>
    </section>
  )
}
