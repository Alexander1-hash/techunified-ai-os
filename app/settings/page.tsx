"use client";

import {
  Bell,
  Building2,
  CheckCircle2,
  Clock3,
  LogOut,
  Shield,
  User,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";

export default function SettingsPage() {
  const {
    user,
    profile,
    organization,
    role,
    loading,
    signOut,
  } = useAuth();

  if (loading) {
    return (
      <main className="min-h-[70vh]">
        <div className="mx-auto max-w-5xl">
          <div className="space-y-6">
            <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
            <div className="h-4 w-72 animate-pulse rounded bg-muted" />

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="h-56 animate-pulse rounded-2xl bg-muted" />
              <div className="h-56 animate-pulse rounded-2xl bg-muted" />
              <div className="h-56 animate-pulse rounded-2xl bg-muted" />
              <div className="h-56 animate-pulse rounded-2xl bg-muted" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  const fullName = String(
    profile?.full_name ??
      user?.user_metadata?.full_name ??
      user?.user_metadata?.name ??
      user?.email?.split("@")[0] ??
      "User",
  );

  const email = user?.email ?? "No email available";

  const organizationName = String(
    organization?.name ?? "No organization",
  );

  const description = String(
    organization?.description ??
      "Your company workspace",
  );

  const industry = String(
    organization?.industry ?? "Technology",
  );

  const timezone = String(
    organization?.timezone ?? "Africa/Lagos",
  );

  const plan = String(
    organization?.plan ?? "Foundation",
  );

  const website = organization?.website
    ? String(organization.website)
    : null;

  const avatarUrl =
    typeof profile?.avatar_url === "string"
      ? profile.avatar_url
      : null;

  const initials =
    fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) =>
        part.charAt(0).toUpperCase(),
      )
      .join("") || "U";

  async function handleSignOut() {
    await signOut();
  }

  return (
    <main className="min-h-[70vh]">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-primary">
            System
          </p>

          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
            Settings
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Manage your TechUnified workspace, account,
            notifications, and system preferences.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Profile */}
          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <User size={19} />
              </div>

              <div>
                <h2 className="font-semibold">
                  Profile
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Your account identity inside TechUnified.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-lg font-semibold text-[#182016]">
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

              <div className="min-w-0">
                <p className="truncate font-medium">
                  {fullName}
                </p>

                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {email}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  {role}
                </p>
              </div>
            </div>
          </section>

          {/* Workspace */}
          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <Building2 size={19} />
              </div>

              <div>
                <h2 className="font-semibold">
                  Workspace
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Your current company workspace.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Organization
                </p>

                <p className="mt-1 font-medium">
                  {organizationName}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Description
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  {description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Industry
                  </p>

                  <p className="mt-1 text-sm font-medium">
                    {industry}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Plan
                  </p>

                  <p className="mt-1 text-sm font-medium text-primary">
                    {plan}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Regional settings */}
          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <Clock3 size={19} />
              </div>

              <div>
                <h2 className="font-semibold">
                  Regional settings
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Time configuration used by the workspace.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border bg-muted/40 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Workspace timezone
              </p>

              <p className="mt-2 font-medium">
                {timezone}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Business activity, automation schedules,
                and reporting use this timezone.
              </p>
            </div>
          </section>

          {/* Notifications */}
          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <Bell size={19} />
              </div>

              <div>
                <h2 className="font-semibold">
                  Notifications
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Control how TechUnified keeps you informed.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border p-4">
              <div>
                <p className="text-sm font-medium">
                  Notification center
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Notification preferences are ready to be
                  configured here.
                </p>
              </div>

              <span className="shrink-0 rounded-full border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                Coming next
              </span>
            </div>
          </section>

          {/* Security */}
          <section className="rounded-2xl border bg-card p-5 shadow-sm lg:col-span-2">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <Shield size={19} />
              </div>

              <div>
                <h2 className="font-semibold">
                  Security & access
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Account access and authentication information.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    size={16}
                    className="text-primary"
                  />

                  <span className="text-sm font-medium">
                    Authentication
                  </span>
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  Your account is authenticated through
                  Supabase.
                </p>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Access role
                </p>

                <p className="mt-2 text-sm font-medium">
                  {role}
                </p>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Account email
                </p>

                <p className="mt-2 truncate text-sm font-medium">
                  {email}
                </p>
              </div>
            </div>

            {website && (
              <div className="mt-4 rounded-xl border bg-muted/30 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Workspace website
                </p>

                <p className="mt-1 truncate text-sm">
                  {website}
                </p>
              </div>
            )}

            <div className="mt-6 flex justify-end border-t pt-5">
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-destructive/30 px-4 py-2.5 text-sm font-medium text-destructive transition hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
