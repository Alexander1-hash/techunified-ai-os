'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, ChevronDown, LogOut, Menu, Search, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { nav } from '@/lib/data'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/auth-provider'

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const { user, profile, organization, role } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (path === '/login' || path.startsWith('/auth') || path === '/about' || path.startsWith('/founder')) {
    return <>{children}</>
  }

  async function signOut() {
    await createClient().auth.signOut()
    window.location.assign('/login')
  }

  const navigation = (
    <nav aria-label="Primary navigation" className="flex flex-1 flex-col gap-1 p-4">
      {nav.map(([label, href, icon]) => (
        <Link
          key={href}
          href={href}
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${path === href || path.startsWith(`${href}/`) ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
        >
          <span className="w-5 text-center text-base" aria-hidden="true">{icon}</span>
          {label}
        </Link>
      ))}
    </nav>
  )

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-[#09151e] lg:flex lg:flex-col">
        <div className="flex h-20 items-center gap-3 border-b px-6">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Sparkles size={18} /></div>
          <div><div className="font-semibold tracking-tight">TECHUNIFIED</div><div className="text-[10px] uppercase tracking-[.24em] text-muted-foreground">AI OS</div></div>
        </div>
        {navigation}
        <WorkspaceFooter profile={profile} user={user} organization={organization} role={role} onSignOut={signOut} />
      </aside>

      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:ml-64 lg:px-8">
        <button type="button" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden" aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileOpen} onClick={() => setMobileOpen((open) => !open)}>
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex"><Search size={16} /><span>Search anything...</span></div>
        <div className="ml-auto flex items-center gap-2"><button type="button" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Notifications"><Bell size={18} /></button><div className="hidden size-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-[#182016] sm:flex">AS</div></div>
      </header>

      {mobileOpen && <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Mobile navigation"><button type="button" className="absolute inset-0 bg-black/50" aria-label="Close navigation menu" onClick={() => setMobileOpen(false)} /><aside className="relative flex h-full w-72 max-w-[85vw] flex-col border-r bg-[#09151e] shadow-xl"><div className="flex h-20 items-center justify-between border-b px-6"><div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Sparkles size={18} /></div><div><div className="font-semibold tracking-tight">TECHUNIFIED</div><div className="text-[10px] uppercase tracking-[.24em] text-muted-foreground">AI OS</div></div></div><button type="button" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close navigation menu" onClick={() => setMobileOpen(false)}><X size={18} /></button></div>{navigation}<WorkspaceFooter profile={profile} user={user} organization={organization} role={role} onSignOut={signOut} /></aside></div>}

      <main className="lg:ml-64"><div className="mx-auto max-w-[1600px] p-5 lg:p-8">{children}</div></main>
    </div>
  )
}

function WorkspaceFooter({ profile, user, organization, role, onSignOut }: { profile: any; user: any; organization: any; role: any; onSignOut: () => void }) {
  return <div className="border-t p-4"><div className="mb-3 rounded-lg bg-muted/60 p-3"><div className="text-xs text-muted-foreground">Workspace</div><div className="mt-1 flex items-center justify-between text-sm font-medium">TechUnified <ChevronDown size={14} /></div><div className="mt-2 text-xs text-primary">Scale plan</div></div><div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-full bg-accent font-semibold text-[#182016]">AS</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{String(profile?.full_name ?? user?.user_metadata?.full_name ?? 'Alexander Smith')}</div><div className="truncate text-xs text-muted-foreground">{String(role ?? 'Owner')} · {String(organization?.name ?? 'TechUnified')}</div></div><button type="button" onClick={onSignOut} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Sign out"><LogOut size={16} /></button></div></div>
}
