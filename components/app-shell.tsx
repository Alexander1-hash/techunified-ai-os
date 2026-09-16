"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Menu,
  Search,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import { navGroups } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { TechUnifiedBrand } from "@/components/techunified-brand";

export function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const path = usePathname();

  const {
    user,
    profile,
    organization,
    role,
  } = useAuth();

  const [mobileOpen, setMobileOpen] =
    useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  const [openGroups, setOpenGroups] =
    useState<Record<string, boolean>>({});

  const [notificationsOpen, setNotificationsOpen] =
    useState(false);

  const [
    headerSigningOut,
    setHeaderSigningOut,
  ] = useState(false);

  const [
    headerSignOutError,
    setHeaderSignOutError,
  ] = useState("");

  const notificationsRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!notificationsOpen) return;

    function handlePointerDown(
      event: PointerEvent,
    ) {
      if (
        !notificationsRef.current?.contains(
          event.target as Node,
        )
      ) {
        setNotificationsOpen(false);
      }
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
      }
    }

    document.addEventListener(
      "pointerdown",
      handlePointerDown,
    );

    document.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown,
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [notificationsOpen]);

  if (
    path === "/login" ||
    path.startsWith("/auth") ||
    path === "/about" ||
    path.startsWith("/founder") ||
    path === "/onboarding"
  ) {
    return <>{children}</>;
  }

  async function signOut() {
    const { error } =
      await createClient().auth.signOut();

    if (error) {
      throw error;
    }

    window.location.assign("/login");
  }

  async function handleHeaderSignOut() {
    setHeaderSigningOut(true);
    setHeaderSignOutError("");

    try {
      await signOut();
    } catch {
      setHeaderSigningOut(false);
      setHeaderSignOutError(
        "Unable to sign out. Please try again.",
      );
    }
  }

  function toggleGroup(label: string) {
    setOpenGroups((groups) => ({
      ...groups,
      [label]: !(groups[label] ?? true),
    }));
  }

  const displayName = String(
    profile?.full_name ??
      user?.user_metadata?.full_name ??
      user?.user_metadata?.name ??
      user?.email?.split("@")[0] ??
      "User",
  );

  const organizationName = String(
    organization?.name ?? "No organization",
  );

  const displayRole = String(
    role ?? profile?.role ?? "Viewer",
  );

  const plan = String(
    organization?.plan ?? "Foundation",
  );

  const avatarUrl =
    typeof profile?.avatar_url === "string"
      ? profile.avatar_url
      : null;

  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) =>
        part.charAt(0).toUpperCase(),
      )
      .join("") || "U";

  const navigation = (
    <nav
      aria-label="Primary navigation"
      className="flex flex-1 flex-col gap-4 overflow-y-auto p-3"
    >
      {navGroups.map((group) => {
        const isOpen =
          openGroups[group.label] ?? true;

        return (
          <section
            key={group.label}
            aria-label={group.label}
          >
            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={() =>
                  toggleGroup(group.label)
                }
                className="mb-1 flex min-h-8 w-full items-center justify-between px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70 hover:text-foreground"
                aria-expanded={isOpen}
              >
                {group.label}

                <ChevronDown
                  className={`transition-transform ${
                    isOpen
                      ? ""
                      : "-rotate-90"
                  }`}
                />
              </button>
            )}

            {isOpen && (
              <div className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const active =
                    path === item.href ||
                    path.startsWith(
                      `${item.href}/`,
                    );

                  const Icon = item.icon;

                  return (
                    <Link
                      key={`${group.label}-${item.label}`}
                      href={item.href}
                      onClick={() =>
                        setMobileOpen(false)
                      }
                      title={
                        sidebarCollapsed
                          ? item.label
                          : undefined
                      }
                      aria-current={
                        active
                          ? "page"
                          : undefined
                      }
                      className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      } ${
                        sidebarCollapsed
                          ? "justify-center"
                          : ""
                      }`}
                    >
                      <Icon aria-hidden="true" />

                      {!sidebarCollapsed && (
                        <span>
                          {item.label}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden border-r bg-[#09151e] transition-[width] lg:flex lg:flex-col ${
          sidebarCollapsed
            ? "w-20"
            : "w-64"
        }`}
      >
        <div
          className={`flex h-20 items-center border-b ${
            sidebarCollapsed
              ? "justify-center px-3"
              : "px-6"
          }`}
        >
          <TechUnifiedBrand
            compact={sidebarCollapsed}
          />
        </div>

        {navigation}

        <div className="border-t p-3">
          <button
            type="button"
            onClick={() =>
              setSidebarCollapsed(
                (collapsed) => !collapsed,
              )
            }
            className={`flex min-h-11 w-full items-center rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground ${
              sidebarCollapsed
                ? "justify-center"
                : "gap-3"
            }`}
            aria-label={
              sidebarCollapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
            title={
              sidebarCollapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
          >
            {sidebarCollapsed ? (
              <ChevronsRight />
            ) : (
              <>
                <ChevronsLeft />
                <span>
                  Collapse sidebar
                </span>
              </>
            )}
          </button>
        </div>

        <WorkspaceFooter
          profile={profile}
          user={user}
          organization={organization}
          role={role}
          onSignOut={signOut}
        />
      </aside>

      <header
        className={`sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:px-8 ${
          sidebarCollapsed
            ? "lg:ml-20"
            : "lg:ml-64"
        }`}
      >
        <button
          type="button"
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
          aria-label={
            mobileOpen
              ? "Close navigation menu"
              : "Open navigation menu"
          }
          aria-expanded={mobileOpen}
          onClick={() => {
            setMobileOpen(
              (open) => !open,
            );
            setSidebarCollapsed(false);
          }}
        >
          {mobileOpen ? (
            <X size={20} />
          ) : (
            <Menu size={20} />
          )}
        </button>

        <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
          <Search size={16} />
          <span>
            Search anything...
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleHeaderSignOut}
            disabled={headerSigningOut}
            className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-60"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut size={16} />

            <span className="hidden sm:inline">
              {headerSigningOut
                ? "Logging out…"
                : "Log out"}
            </span>
          </button>

          {headerSignOutError && (
            <span
              className="sr-only"
              role="alert"
            >
              {headerSignOutError}
            </span>
          )}

          <div
            ref={notificationsRef}
            className="relative"
          >
            <button
              type="button"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95"
              aria-label="Notifications"
              aria-expanded={
                notificationsOpen
              }
              aria-controls="notifications-popover"
              onClick={() =>
                setNotificationsOpen(
                  (open) => !open,
                )
              }
            >
              <Bell size={18} />
            </button>

            {notificationsOpen && (
              <div
                id="notifications-popover"
                role="status"
                aria-live="polite"
                className="absolute right-0 top-12 z-50 w-[min(20rem,calc(100vw-2rem))] rounded-xl border bg-card p-4 text-card-foreground shadow-2xl"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                    <Bell size={17} />
                  </div>

                  <div>
                    <p className="text-sm font-medium">
                      Notifications
                    </p>

                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Notification preferences can be managed in Settings.
                    </p>

                    <Link
                      href="/settings/notifications"
                      className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
                      onClick={() =>
                        setNotificationsOpen(
                          false,
                        )
                      }
                    >
                      Notification settings
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div
            className="hidden size-8 items-center justify-center overflow-hidden rounded-full bg-accent text-sm font-semibold text-[#182016] sm:flex"
            title={displayName}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              initials
            )}
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close navigation menu"
            onClick={() =>
              setMobileOpen(false)
            }
          />

          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col border-r bg-[#09151e] shadow-xl">
            <div className="flex h-20 items-center justify-between border-b px-6">
              <TechUnifiedBrand />

              <button
                type="button"
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close navigation menu"
                onClick={() =>
                  setMobileOpen(false)
                }
              >
                <X size={18} />
              </button>
            </div>

            {navigation}

            <WorkspaceFooter
              profile={profile}
              user={user}
              organization={organization}
              role={role}
              onSignOut={signOut}
            />
          </aside>
        </div>
      )}

      <main
        className={`min-w-0 ${
          sidebarCollapsed
            ? "lg:ml-20"
            : "lg:ml-64"
        }`}
      >
        <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-5 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

function WorkspaceFooter({
  profile,
  user,
  organization,
  role,
  onSignOut,
}: {
  profile: Record<string, unknown> | null;
  user: {
    email?: string;
    user_metadata?: {
      full_name?: string;
      name?: string;
    };
  } | null;
  organization: Record<string, unknown> | null;
  role: string;
  onSignOut: () => Promise<void>;
}) {
  const [isSigningOut, setIsSigningOut] =
    useState(false);

  const [signOutError, setSignOutError] =
    useState("");

  const displayName = String(
    profile?.full_name ??
      user?.user_metadata?.full_name ??
      user?.user_metadata?.name ??
      user?.email?.split("@")[0] ??
      "User",
  );

  const organizationName = String(
    organization?.name ??
      "No organization",
  );

  const displayRole = String(
    role ?? profile?.role ?? "Viewer",
  );

  const plan = String(
    organization?.plan ?? "Foundation",
  );

  const avatarUrl =
    typeof profile?.avatar_url === "string"
      ? profile.avatar_url
      : null;

  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) =>
        part.charAt(0).toUpperCase(),
      )
      .join("") || "U";

  async function handleSignOut() {
    setIsSigningOut(true);
    setSignOutError("");

    try {
      await onSignOut();
    } catch {
      setIsSigningOut(false);
      setSignOutError(
        "Unable to sign out. Please try again.",
      );
    }
  }

  return (
    <div className="border-t p-4">
      <div className="mb-3 rounded-lg bg-muted/60 p-3">
        <div className="text-xs text-muted-foreground">
          Workspace
        </div>

        <div className="mt-1 flex items-center justify-between text-sm font-medium">
          {organizationName}
          <ChevronDown size={14} />
        </div>

        <div className="mt-2 text-xs text-primary">
          {plan}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center overflow-hidden rounded-full bg-accent font-semibold text-[#182016]">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            initials
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {displayName}
          </div>

          <div className="truncate text-xs text-muted-foreground">
            {displayRole} · {organizationName}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-60"
          aria-label="Log out"
          title="Log out"
        >
          <LogOut size={16} />

          <span className="hidden sm:inline">
            {isSigningOut
              ? "Logging out…"
              : "Log out"}
          </span>
        </button>
      </div>

      {signOutError && (
        <p
          className="mt-2 text-xs text-destructive"
          role="alert"
        >
          {signOutError}
        </p>
      )}
    </div>
  );
  }
