"use client";

import {
  Bell,
  Building2,
  CheckCircle2,
  Clock3,
  Edit3,
  LogOut,
  Save,
  Shield,
  User,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

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

  const [isEditingProfile, setIsEditingProfile] =
    useState(false);
  const [fullNameInput, setFullNameInput] = useState("");
  const [avatarUrlInput, setAvatarUrlInput] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    setFullNameInput(profile?.full_name ?? "");
    setAvatarUrlInput(profile?.avatar_url ?? "");
  }, [profile]);

  useEffect(() => {
    if (!message) return;

    const timeout = window.setTimeout(() => {
      setMessage(null);
    }, 4000);

    return () => window.clearTimeout(timeout);
  }, [message]);

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

  const previewName =
    fullNameInput.trim() || fullName;

  const previewAvatarUrl =
    avatarUrlInput.trim() || null;

  const initials =
    previewName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) =>
        part.charAt(0).toUpperCase(),
      )
      .join("") || "U";

  function startEditingProfile() {
    setFullNameInput(profile?.full_name ?? "");
    setAvatarUrlInput(profile?.avatar_url ?? "");
    setMessage(null);
    setIsEditingProfile(true);
  }

  function cancelEditingProfile() {
    setFullNameInput(profile?.full_name ?? "");
    setAvatarUrlInput(profile?.avatar_url ?? "");
    setMessage(null);
    setIsEditingProfile(false);
  }

  async function handleSaveProfile() {
    const trimmedName = fullNameInput.trim();
    const trimmedAvatarUrl = avatarUrlInput.trim();

    if (!trimmedName) {
      setMessage({
        type: "error",
        text: "Please enter your full name.",
      });
      return;
    }

    if (trimmedName.length > 120) {
      setMessage({
        type: "error",
        text: "Full name must be 120 characters or fewer.",
      });
      return;
    }

    if (trimmedAvatarUrl.length > 1000) {
      setMessage({
        type: "error",
        text: "Avatar URL must be 1000 characters or fewer.",
      });
      return;
    }

    setSavingProfile(true);
    setMessage(null);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: trimmedName,
          avatar_url: trimmedAvatarUrl || null,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to update your profile.",
        );
      }

      setIsEditingProfile(false);

      setMessage({
        type: "success",
        text: "Profile updated successfully.",
      });

      window.location.reload();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to update your profile.",
      });
    } finally {
      setSavingProfile(false);
    }
  }

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

        {message && (
          <div
            className={`mb-6 flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-sm ${
              message.type === "success"
                ? "border-primary/20 bg-primary/5 text-foreground"
                : "border-destructive/30 bg-destructive/5 text-destructive"
            }`}
            role="status"
          >
            <div className="flex items-center gap-2">
              {message.type === "success" ? (
                <CheckCircle2 size={17} />
              ) : (
                <X size={17} />
              )}

              <span>{message.text}</span>
            </div>

            <button
              type="button"
              onClick={() => setMessage(null)}
              className="rounded-lg p-1 transition hover:bg-black/5"
              aria-label="Dismiss message"
            >
              <X size={15} />
            </button>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Profile */}
          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
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

              {!isEditingProfile && (
                <button
                  type="button"
                  onClick={startEditingProfile}
                  className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Edit3 size={15} />
                  Edit
                </button>
              )}
            </div>

            {!isEditingProfile ? (
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
            ) : (
              <div className="mt-6 space-y-5">
                <div className="flex items-center gap-4">
                  <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-lg font-semibold text-[#182016]">
                    {previewAvatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewAvatarUrl}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      initials
                    )}
                  </div>

                  <div>
                    <p className="font-medium">
                      {previewName}
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {email}
                    </p>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="full-name"
                    className="text-sm font-medium"
                  >
                    Full name
                  </label>

                  <input
                    id="full-name"
                    type="text"
                    value={fullNameInput}
                    onChange={(event) =>
                      setFullNameInput(event.target.value)
                    }
                    placeholder="Your full name"
                    maxLength={120}
                    className="mt-2 flex h-11 w-full rounded-xl border bg-background px-3.5 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="avatar-url"
                    className="text-sm font-medium"
                  >
                    Avatar URL
                  </label>

                  <input
                    id="avatar-url"
                    type="url"
                    value={avatarUrlInput}
                    onChange={(event) =>
                      setAvatarUrlInput(event.target.value)
                    }
                    placeholder="https://example.com/avatar.jpg"
                    maxLength={1000}
                    className="mt-2 flex h-11 w-full rounded-xl border bg-background px-3.5 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />

                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Optional. Use a publicly accessible image URL.
                  </p>
                </div>

                <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={cancelEditingProfile}
                    disabled={savingProfile}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X size={16} />
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save size={16} />
                    {savingProfile
                      ? "Saving..."
                      : "Save changes"}
                  </button>
                </div>
              </div>
            )}
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
