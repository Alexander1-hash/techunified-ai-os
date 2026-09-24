"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Menu,
  Monitor,
  Moon,
  Search,
  Settings2,
  Sun,
  X,
  LogOut,
  UserRound,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { GlobalSearch } from "@/components/global-search"
import { navGroups } from "@/lib/data"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/components/auth-provider"
import { useTheme, type Theme } from "@/components/theme-provider"
import { TechUnifiedBrand } from "@/components/techunified-brand"

const LOCAL_PROFILE_IMAGE =
  "/profile/b22e2190-dc10-4de4-af97-92fc1437e690_20260924_040359_0000.png"

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const { user, profile, organization, role } = useAuth()
  const [mobile, setMobile] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [notifications, setNotifications] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const notificationRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node

      if (!notificationRef.current?.contains(target)) {
        setNotifications(false)
      }

      if (!profileRef.current?.contains(target)) {
        setProfileOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
    }
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobile ? "hidden" : ""

    return () => {
      document.body.style.overflow = ""
    }
  }, [mobile])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return

      setMobile(false)
      setProfileOpen(false)
      setNotifications(false)
    }

    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("keydown", handleEscape)
    }
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
    <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-2">
      <div className="space-y-5">
        {navGroups.map((group) => (
          <section key={group.label}>
            <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
              {group.label}
            </div>

            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  path === item.href ||
                  path.startsWith(item.href + "/")
                const Icon = item.icon

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={closeMobile}
                    title={collapsed ? item.label : undefined}
                    className={[
                      "group flex min-h-9 items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] transition-colors",
                      collapsed ? "justify-center" : "",
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    ].join(" ")}
                  >
                    <Icon size={16} strokeWidth={1.8} className="shrink-0" />
                    {!collapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </Link>
                )
              })}
            </div>
          </section>
        ))}

        {!collapsed && (
          <section>
            <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
              Recent
            </div>
            <Link
              href="/activity"
              onClick={closeMobile}
              className="flex min-h-9 items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            >
              <HistoryIcon />
              <span>Recent activity</span>
            </Link>
          </section>
        )}
      </div>
    </nav>
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside
        className={[
          "fixed inset-y-0 left-0 hidden border-r border-border bg-card lg:flex lg:flex-col",
          collapsed ? "w-[72px]" : "w-[256px]",
          profileOpen ? "z-[210]" : "z-50",
        ].join(" ")}
      >
        <div className="flex h-14 shrink-0 items-center border-b border-border px-3">
          <TechUnifiedBrand compact={collapsed} />

          {!collapsed && (
            <button
              aria-label="Collapse sidebar"
              onClick={() => setCollapsed(true)}
              className="ml-auto flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft size={17} />
            </button>
          )}
        </div>

        {!collapsed && (
          <div className="px-3 pt-3">
            <div className="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-xs text-muted-foreground">
              <Search size={14} />
              <span>Search</span>
              <span className="ml-auto text-[10px]">⌘ K</span>
            </div>
          </div>
        )}

        {navigation}

        <div className="shrink-0 border-t border-border p-2">
          <button
            onClick={() => setCollapsed((value) => !value)}
            className="flex min-h-9 w-full items-center justify-center gap-3 rounded-lg px-2.5 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
            {!collapsed && <span>Collapse sidebar</span>}
          </button>
        </div>

        <ProfileMenu
          profile={profile}
          user={user}
          organization={organization}
          role={role}
          signOut={signOut}
          collapsed={collapsed}
          profileRef={profileRef}
          open={profileOpen}
          setOpen={setProfileOpen}
          onNavigate={closeMobile}
        />
      </aside>

      <header
        className={[
          "sticky top-0 z-30 flex h-14 items-center border-b border-border bg-background px-3 lg:px-5",
          collapsed ? "lg:ml-[72px]" : "lg:ml-[256px]",
        ].join(" ")}
      >
        <button
          aria-label={mobile ? "Close navigation" : "Open navigation"}
          onClick={() => setMobile((value) => !value)}
          className="mr-2 flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
        >
          {mobile ? <X size={19} /> : <Menu size={19} />}
        </button>

        <div className="min-w-0 flex-1">
          <GlobalSearch />
        </div>

        <div className="ml-2 flex shrink-0 items-center gap-1">
          <div ref={notificationRef} className="relative">
            <button
              aria-label="Notifications"
              onClick={() => setNotifications((value) => !value)}
              className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Bell size={17} strokeWidth={1.8} />
            </button>

            {notifications && (
              <div
                className="fixed right-3 top-[4.25rem] z-[220] isolate w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-white/10 bg-[#0b0b0b] p-2 text-white shadow-2xl sm:absolute sm:right-0 sm:top-11 sm:max-w-[calc(100vw-1rem)]"
              >
                <div className="rounded-lg border border-white/10 bg-[#111111] px-3 py-3 text-white shadow-inner">
                  <p className="text-sm font-semibold text-white">Notifications</p>
                  <p className="pt-1 text-xs leading-5 text-white/60">
                    Notification preferences can be managed in Settings.
                  </p>
                </div>

                <Link
                  href="/settings"
                  onClick={() => setNotifications(false)}
                  className="mt-1 flex min-h-10 items-center rounded-lg px-3 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white"
                >
                  Notification settings
                </Link>
              </div>
            )}
          </div>

          <button
            aria-label="Open profile menu"
            onClick={() => {
              setNotifications(false)
              setProfileOpen((value) => !value)
            }}
            className="flex size-8 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-[10px] font-semibold sm:size-9"
          >
            <Avatar profile={profile} user={user} />
          </button>
        </div>
      </header>

      {mobile && (
        <>
          <button
            aria-label="Close navigation"
            onClick={closeMobile}
            className="fixed inset-0 z-[90] bg-black lg:hidden"
          />

          <aside
            className={[
              "fixed inset-y-0 left-0 flex w-[min(292px,82vw)] flex-col border-r border-border bg-card text-foreground shadow-2xl lg:hidden",
              profileOpen ? "z-[210]" : "z-[100]",
            ].join(" ")}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <div className="flex h-14 shrink-0 items-center border-b border-border px-3">
              <TechUnifiedBrand />

              <button
                aria-label="Close navigation"
                onClick={closeMobile}
                className="ml-auto flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={19} />
              </button>
            </div>

            <div className="px-3 pt-3">
              <GlobalSearch />
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              {navigation}
            </div>

            <ProfileMenu
              profile={profile}
              user={user}
              organization={organization}
              role={role}
              signOut={signOut}
              collapsed={false}
              profileRef={profileRef}
              open={profileOpen}
              setOpen={setProfileOpen}
              onNavigate={closeMobile}
            />
          </aside>
        </>
      )}

      <main
        className={[
          "min-h-[calc(100vh-3.5rem)]",
          collapsed ? "lg:ml-[72px]" : "lg:ml-[256px]",
        ].join(" ")}
      >
        <div className="mx-auto w-full max-w-[1500px] px-3 py-4 sm:px-5 sm:py-5 lg:px-7 lg:py-7">
          {children}
        </div>
      </main>
    </div>
  )
}

function HistoryIcon() {
  return <span className="text-[14px] leading-none">↺</span>
}

function Avatar({
  profile,
  user,
}: {
  profile: Record<string, unknown> | null
  user: {
    email?: string
    user_metadata?: {
      full_name?: string
      name?: string
    }
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
    typeof profile?.avatar_url === "string" && profile.avatar_url.trim()
      ? profile.avatar_url
      : LOCAL_PROFILE_IMAGE

  return (
    <img
      src={url}
      alt={name}
      className="size-full object-cover"
    />
  )
}

function ProfileMenu({
  profile,
  user,
  organization,
  role,
  signOut,
  collapsed,
  profileRef,
  open,
  setOpen,
  onNavigate,
}: {
  profile: Record<string, unknown> | null
  user: {
    email?: string
    user_metadata?: {
      full_name?: string
      name?: string
    }
  } | null
  organization: Record<string, unknown> | null
  role: string
  signOut: () => Promise<void>
  collapsed: boolean
  profileRef: React.RefObject<HTMLDivElement | null>
  open: boolean
  setOpen: (value: boolean) => void
  onNavigate: () => void
}) {
  const { theme, setTheme } = useTheme()

  const name = String(
    profile?.full_name ??
      user?.user_metadata?.full_name ??
      user?.user_metadata?.name ??
      user?.email?.split("@")[0] ??
      "User",
  )

  const org = String(
    organization?.name ?? "Set up organization",
  )

  const options: [Theme, string, typeof Sun][] = [
    ["system", "System", Monitor],
    ["light", "Light", Sun],
    ["dark", "Dark", Moon],
  ]

  return (
    <div className="relative shrink-0 border-t border-border bg-card p-2">
      <div ref={profileRef} className="relative">
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className={[
            "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-muted",
            open ? "bg-muted" : "",
          ].join(" ")}
        >
          <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-[10px] font-semibold">
            <Avatar profile={profile} user={user} />
          </div>

          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium">
                  {name}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {role}
                </p>
              </div>
              <ChevronDown
                size={14}
                className={[
                  "text-muted-foreground transition-transform",
                  open ? "rotate-180" : "",
                ].join(" ")}
              />
            </>
          )}
        </button>

        {open && (
          <div
            className={[
              "absolute z-[220] isolate overflow-hidden rounded-xl border border-white/10 bg-[#0b0b0b] p-2 text-white shadow-2xl",
              collapsed
                ? "bottom-0 left-full ml-2 w-72"
                : "bottom-[calc(100%+8px)] left-0 right-0",
            ].join(" ")}
          >
            <div className="rounded-lg border border-white/10 bg-[#111111] px-3 py-3 text-white shadow-inner">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-[#1b1b1b] text-[10px] font-semibold">
                  <Avatar profile={profile} user={user} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{name}</p>
                  <p className="mt-1 truncate text-[11px] text-white/60">
                    {role} · {org}
                  </p>
                </div>
                <ChevronDown
                  size={15}
                  className={[
                    "shrink-0 text-white/60 transition-transform",
                    open ? "rotate-180" : "",
                  ].join(" ")}
                />
              </div>
            </div>

            <Link
              href="/founder"
              onClick={() => {
                setOpen(false)
                onNavigate()
              }}
              className="mt-1 flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm text-white/80 hover:bg-white/10 hover:text-white"
            >
              <UserRound size={15} />
              Founder profile
            </Link>

            <Link
              href="/settings"
              onClick={() => {
                setOpen(false)
                onNavigate()
              }}
              className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm text-white/80 hover:bg-white/10 hover:text-white"
            >
              <Settings2 size={15} />
              Workspace settings
            </Link>

            <div className="my-2 border-t border-white/10" />

            <p className="px-3 pt-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Appearance
            </p>

            <div className="mt-1.5 grid grid-cols-3 gap-0.5 rounded-lg bg-muted p-0.5">
              {options.map(([value, label, Icon]) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={[
                    "flex min-h-8 items-center justify-center gap-1 rounded-md text-[11px]",
                    theme === value
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>

            <button
              onClick={signOut}
              className="mt-2 flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-white/70 hover:bg-white/10 hover:text-white"
            >
              <LogOut size={15} />
              Log out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
