"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowRight,
  Bell,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Settings2,
  Sun,
  UserRound,
  X,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { GlobalSearch } from "@/components/global-search"
import { navGroups } from "@/lib/data"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/components/auth-provider"
import { useTheme, type Theme } from "@/components/theme-provider"
import { TechUnifiedBrand } from "@/components/techunified-brand"

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const { user, profile, organization, role } = useAuth()
  const [mobile, setMobile] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [notifications, setNotifications] = useState(false)
  const [open, setOpen] = useState(false)
  const nref = useRef<HTMLDivElement>(null)
  const pref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!nref.current?.contains(target)) setNotifications(false)
      if (!pref.current?.contains(target)) setOpen(false)
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobile ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [mobile])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobile(false)
        setOpen(false)
        setNotifications(false)
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [])

  if (
    path === "/login" ||
    path.startsWith("/auth") ||
    path === "/about" ||
    path.startsWith("/founder") ||
    path === "/onboarding"
  ) {
    return <>{children}</>
  }

  const signOut = async () => {
    const { error } = await createClient().auth.signOut()
    if (error) throw error
    window.location.assign("/login")
  }

  const closeMobile = () => setMobile(false)

  const navigation = (
    <nav className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
      <Link
        href="/dashboard"
        onClick={closeMobile}
        className="flex min-h-12 shrink-0 items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 text-sm font-semibold text-primary"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ArrowRight size={15} />
        </span>
        {!collapsed && "Get Started"}
      </Link>

      {navGroups.map((group) => (
        <section key={group.label} className="shrink-0">
          <div
            className={
              collapsed
                ? "hidden"
                : "mb-1 flex min-h-8 items-center px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-muted-foreground"
            }
          >
            {group.label}
          </div>

          <div className="flex flex-col gap-1">
            {group.items.map((item) => {
              const active =
                path === item.href || path.startsWith(item.href + "/")
              const Icon = item.icon

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={closeMobile}
                  title={collapsed ? item.label : undefined}
                  className={
                    "flex min-h-10 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors " +
                    (active
                      ? "bg-primary/10 text-primary shadow-[inset_2px_0_0_var(--primary)]"
                      : "text-foreground hover:bg-muted hover:text-foreground") +
                    (collapsed ? " justify-center" : "")
                  }
                >
                  <Icon size={17} className="shrink-0" />
                  {!collapsed && item.label}
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </nav>
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside
        className={
          "fixed inset-y-0 left-0 z-50 hidden border-r border-border bg-card lg:flex lg:flex-col " +
          (collapsed ? "w-20" : "w-72")
        }
      >
        <div
          className={
            "flex h-16 shrink-0 items-center border-b border-border " +
            (collapsed
              ? "justify-center px-3"
              : "justify-between px-5")
          }
        >
          <TechUnifiedBrand compact={collapsed} />

          {!collapsed && (
            <button
              aria-label="Collapse navigation"
              onClick={() => setCollapsed(true)}
              className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {navigation}

        <div className="shrink-0 border-t border-border p-3">
          <button
            onClick={() => setCollapsed((value) => !value)}
            className={
              "flex min-h-10 w-full items-center rounded-xl px-3 text-sm text-foreground hover:bg-muted " +
              (collapsed ? "justify-center" : "gap-3")
            }
          >
            {collapsed ? (
              <ChevronsRight size={18} />
            ) : (
              <>
                <ChevronsLeft size={18} />
                Collapse sidebar
              </>
            )}
          </button>
        </div>

        <ProfileMenu
          profile={profile}
          user={user}
          organization={organization}
          role={role}
          signOut={signOut}
          collapsed={collapsed}
          pref={pref}
          open={open}
          setOpen={setOpen}
        />
      </aside>

      <header
        className={
          "sticky top-0 z-30 flex h-16 items-center border-b border-border bg-background px-4 lg:px-8 " +
          (collapsed ? "lg:ml-20" : "lg:ml-72")
        }
      >
        <button
          aria-label={mobile ? "Close navigation" : "Open navigation"}
          className="rounded-xl p-2 text-foreground hover:bg-muted lg:hidden"
          onClick={() => setMobile((value) => !value)}
        >
          {mobile ? <X size={20} /> : <Menu size={20} />}
        </button>

        <GlobalSearch />

        <div className="ml-auto flex items-center gap-2">
          <div ref={nref} className="relative">
            <button
              aria-label="Notifications"
              className="flex size-10 items-center justify-center rounded-xl text-foreground hover:bg-muted"
              onClick={() => setNotifications((value) => !value)}
            >
              <Bell size={18} />
            </button>

            {notifications && (
              <div className="absolute right-0 top-12 z-[60] w-80 rounded-2xl border border-border bg-card p-4 text-foreground shadow-2xl">
                <p className="font-semibold">Notifications</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Notification preferences can be managed in Settings.
                </p>
                <Link
                  href="/settings"
                  onClick={() => setNotifications(false)}
                  className="mt-3 inline-block text-xs font-medium text-primary"
                >
                  Notification settings
                </Link>
              </div>
            )}
          </div>

          <button
            aria-label="Open profile menu"
            className="hidden size-9 items-center justify-center overflow-hidden rounded-full border border-border bg-card text-foreground sm:flex"
            onClick={() => setOpen((value) => !value)}
          >
            <Avatar profile={profile} user={user} />
          </button>
        </div>
      </header>

      {mobile && (
        <div
          className="fixed inset-0 z-[100] block h-[100dvh] w-screen overflow-hidden bg-background text-foreground lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div className="flex h-full w-full min-h-0 flex-col bg-background">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background px-4">
              <TechUnifiedBrand />

              <button
                aria-label="Close navigation"
                onClick={closeMobile}
                className="rounded-xl p-2 text-foreground hover:bg-muted"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col bg-background">
              {navigation}
            </div>

            <ProfileMenu
              profile={profile}
              user={user}
              organization={organization}
              role={role}
              signOut={signOut}
              collapsed={false}
              pref={pref}
              open={open}
              setOpen={setOpen}
            />
          </div>
        </div>
      )}

      <main
        className={
          "min-h-[calc(100vh-4rem)] " +
          (collapsed ? "lg:ml-20" : "lg:ml-72")
        }
      >
        <div className="mx-auto max-w-[1600px] p-4 sm:p-5 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}

function Avatar({
  profile,
  user,
}: {
  profile: Record<string, unknown> | null
  user: {
    email?: string
    user_metadata?: { full_name?: string; name?: string }
  } | null
}) {
  const name = String(
    profile?.full_name ??
      user?.user_metadata?.full_name ??
      user?.user_metadata?.name ??
      user?.email?.split("@")[0] ??
      "User",
  )

  const url =
    typeof profile?.avatar_url === "string"
      ? profile.avatar_url
      : null

  return url ? (
    <img src={url} alt="" className="size-full object-cover" />
  ) : (
    <span>
      {name
        .split(/s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((value) => value[0])
        .join("")
        .toUpperCase() || "U"}
    </span>
  )
}

function ProfileMenu({
  profile,
  user,
  organization,
  role,
  signOut,
  collapsed,
  pref,
  open,
  setOpen,
}: {
  profile: Record<string, unknown> | null
  user: {
    email?: string
    user_metadata?: { full_name?: string; name?: string }
  } | null
  organization: Record<string, unknown> | null
  role: string
  signOut: () => Promise<void>
  collapsed: boolean
  pref: React.RefObject<HTMLDivElement | null>
  open: boolean
  setOpen: (value: boolean) => void
}) {
  const { theme, setTheme } = useTheme()

  const name = String(
    profile?.full_name ??
      user?.user_metadata?.full_name ??
      user?.user_metadata?.name ??
      user?.email?.split("@")[0] ??
      "Alexander Trimnell",
  )

  const org = String(organization?.name ?? "Set up organization")

  const options: [Theme, string, typeof Sun][] = [
    ["system", "System", Monitor],
    ["light", "Light", Sun],
    ["dark", "Dark", Moon],
  ]

  return (
    <div className="relative shrink-0 border-t border-border bg-card p-3 text-foreground">
      <div ref={pref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className={
            "group flex min-h-12 w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-foreground transition hover:bg-muted " +
            (open ? "bg-muted" : "")
          }
        >
          <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-[11px] font-semibold text-foreground">
            <Avatar profile={profile} user={user} />
          </div>

          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-foreground">
                {name}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {role} · {org}
              </p>
            </div>
          )}
        </button>

        {open && (
          <div
            className={
              "absolute z-[110] rounded-2xl border border-border bg-card p-2.5 text-foreground shadow-[0_24px_70px_-24px_rgba(0,0,0,.65)] " +
              (collapsed
                ? "bottom-0 left-full ml-3 w-80"
                : "bottom-[calc(100%+10px)] left-0 right-0")
            }
          >
            <div className="rounded-xl border border-border bg-muted p-3">
              <p className="truncate text-sm font-semibold text-foreground">
                {name}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {role} · {org}
              </p>
            </div>

            <Link
              href="/dashboard"
              onClick={() => {
                setOpen(false)
                setOpen(false)
              }}
              className="mt-2 flex min-h-11 items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 text-sm font-semibold text-primary hover:bg-primary/10"
            >
              <ArrowRight size={16} />
              Get Started
            </Link>

            <Link
              href="/founder"
              onClick={() => {
                setOpen(false)
                setOpen(false)
              }}
              className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-foreground hover:bg-muted"
            >
              <UserRound size={16} />
              Founder profile
              <ArrowRight className="ml-auto" size={14} />
            </Link>

            <Link
              href="/settings"
              onClick={() => {
                setOpen(false)
                setOpen(false)
              }}
              className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-foreground hover:bg-muted"
            >
              <Settings2 size={16} />
              Workspace settings
              <ArrowRight className="ml-auto" size={14} />
            </Link>

            <div className="my-2 border-t border-border" />

            <p className="px-3 pt-1 text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">
              Appearance
            </p>

            <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl border border-border bg-muted p-1">
              {options.map(([value, label, Icon]) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={
                    "flex min-h-9 items-center justify-center gap-1 rounded-lg text-xs " +
                    (theme === value
                      ? "bg-card text-foreground shadow-sm"
                      : "text-foreground hover:bg-card")
                  }
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>

            <button
              onClick={signOut}
              className="mt-2 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-foreground hover:bg-muted"
            >
              <LogOut size={16} />
              Log out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
