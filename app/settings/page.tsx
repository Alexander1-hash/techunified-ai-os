"use client";

import { useEffect, useState } from "react";
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

import { useAuth } from "@/components/auth-provider";

type MessageType = "success" | "error" | null;

export default function SettingsPage() {
  const {
    profile,
    organization,
    user,
    signOut,
    loading: authLoading,
  } = useAuth();

  const [editingProfile, setEditingProfile] = useState(false);

  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [displayFullName, setDisplayFullName] = useState("");
  const [displayAvatarUrl, setDisplayAvatarUrl] = useState("");

  const [avatarPreviewError, setAvatarPreviewError] = useState(false);
  const [displayAvatarError, setDisplayAvatarError] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] =
    useState<MessageType>(null);

  useEffect(() => {
    const nextFullName = profile?.full_name ?? "";
    const nextAvatarUrl = profile?.avatar_url ?? "";

    setFullName(nextFullName);
    setAvatarUrl(nextAvatarUrl);

    setDisplayFullName(nextFullName);
    setDisplayAvatarUrl(nextAvatarUrl);

    setAvatarPreviewError(false);
    setDisplayAvatarError(false);
  }, [profile]);

  const showMessage = (
    text: string,
    type: Exclude<MessageType, null>,
  ) => {
    setMessage(text);
    setMessageType(type);

    window.setTimeout(() => {
      setMessage(null);
      setMessageType(null);
    }, 4000);
  };

  const handleEditProfile = () => {
    setFullName(displayFullName);
    setAvatarUrl(displayAvatarUrl);
    setAvatarPreviewError(false);
    setEditingProfile(true);
  };

  const handleCancelEdit = () => {
    setFullName(displayFullName);
    setAvatarUrl(displayAvatarUrl);
    setAvatarPreviewError(false);
    setEditingProfile(false);
  };

  const handleSaveProfile = async () => {
    const cleanedName = fullName.trim();
    const cleanedAvatarUrl = avatarUrl.trim();

    if (!cleanedName) {
      showMessage("Full name is required.", "error");
      return;
    }

    if (cleanedName.length > 120) {
      showMessage(
        "Full name must be 120 characters or fewer.",
        "error",
      );
      return;
    }

    if (cleanedAvatarUrl.length > 1000) {
      showMessage(
        "Avatar URL must be 1000 characters or fewer.",
        "error",
      );
      return;
    }

    setSavingProfile(true);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: cleanedName,
          avatar_url: cleanedAvatarUrl || null,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error || "Failed to update profile.",
        );
      }

      const savedName =
        data?.profile?.full_name ?? cleanedName;

      const savedAvatar =
        data?.profile?.avatar_url ??
        (cleanedAvatarUrl || "");

      setDisplayFullName(savedName);
      setDisplayAvatarUrl(savedAvatar);

      setFullName(savedName);
      setAvatarUrl(savedAvatar);

      setAvatarPreviewError(false);
      setDisplayAvatarError(false);

      setEditingProfile(false);

      showMessage(
        "Profile updated successfully.",
        "success",
      );
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Failed to update profile.",
        "error",
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const getInitials = (name: string) => {
    const parts = name
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length === 0) {
      return "AT";
    }

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  };

  const profileName =
    displayFullName ||
    user?.email?.split("@")[0] ||
    "Alexander Trimnell";

  const profileEmail = user?.email ?? "No email available";

  const initials = getInitials(profileName);

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border bg-card shadow-sm">
              <Shield className="h-5 w-5 text-primary" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Settings
              </h1>

              <p className="mt-1 text-sm text-muted-foreground">
                Manage your TechUnified workspace and account.
              </p>
            </div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
              messageType === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {messageType === "success" ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <X className="h-5 w-5 shrink-0" />
            )}

            <span>{message}</span>
          </div>
        )}

        <div className="space-y-6">
          {/* Profile */}
          <section className="rounded-2xl border bg-card shadow-sm">
            <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-muted-foreground" />

                  <h2 className="font-semibold">
                    Profile
                  </h2>
                </div>

                <p className="mt-1 text-sm text-muted-foreground">
                  Your personal account information.
                </p>
              </div>

              {!editingProfile ? (
                <button
                  type="button"
                  onClick={handleEditProfile}
                  disabled={authLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit profile
                </button>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={savingProfile}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />

                    {savingProfile
                      ? "Saving..."
                      : "Save changes"}
                  </button>
                </div>
              )}
            </div>

            <div className="p-5">
              {!editingProfile ? (
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-muted text-xl font-semibold">
                    {displayAvatarUrl &&
                    !displayAvatarError ? (
                      <img
                        src={displayAvatarUrl}
                        alt={profileName}
                        className="h-full w-full object-cover"
                        onError={() =>
                          setDisplayAvatarError(true)
                        }
                      />
                    ) : (
                      initials
                    )}
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold">
                      {profileName}
                    </h3>

                    <p className="mt-1 break-all text-sm text-muted-foreground">
                      {profileEmail}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border bg-muted px-3 py-1 text-xs font-medium">
                        {profile?.role || "Owner"}
                      </span>

                      <span className="rounded-full border bg-muted px-3 py-1 text-xs font-medium">
                        {organization?.name ||
                          "No organization"}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Avatar preview */}
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-muted text-xl font-semibold">
                      {avatarUrl.trim() &&
                      !avatarPreviewError ? (
                        <img
                          src={avatarUrl.trim()}
                          alt="Avatar preview"
                          className="h-full w-full object-cover"
                          onError={() =>
                            setAvatarPreviewError(true)
                          }
                        />
                      ) : (
                        getInitials(
                          fullName || profileName,
                        )
                      )}
                    </div>

                    <div>
                      <p className="font-medium">
                        Profile photo
                      </p>

                      <p className="mt-1 text-sm text-muted-foreground">
                        Use a public image URL for your profile
                        photo.
                      </p>
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <label
                      htmlFor="full-name"
                      className="mb-2 block text-sm font-medium"
                    >
                      Full name
                    </label>

                    <input
                      id="full-name"
                      type="text"
                      value={fullName}
                      onChange={(event) =>
                        setFullName(event.target.value)
                      }
                      placeholder="Enter your full name"
                      maxLength={120}
                      className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label
                      htmlFor="email"
                      className="mb-2 block text-sm font-medium"
                    >
                      Email
                    </label>

                    <input
                      id="email"
                      type="email"
                      value={profileEmail}
                      disabled
                      className="w-full cursor-not-allowed rounded-xl border bg-muted px-4 py-3 text-sm text-muted-foreground"
                    />

                    <p className="mt-2 text-xs text-muted-foreground">
                      Your login email is managed by
                      authentication settings.
                    </p>
                  </div>

                  {/* Avatar URL */}
                  <div>
                    <label
                      htmlFor="avatar-url"
                      className="mb-2 block text-sm font-medium"
                    >
                      Avatar URL
                    </label>

                    <input
                      id="avatar-url"
                      type="url"
                      value={avatarUrl}
                      onChange={(event) => {
                        setAvatarUrl(event.target.value);
                        setAvatarPreviewError(false);
                      }}
                      placeholder="https://example.com/avatar.jpg"
                      maxLength={1000}
                      className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Workspace */}
          <section className="rounded-2xl border bg-card shadow-sm">
            <div className="border-b p-5">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />

                <h2 className="font-semibold">
                  Workspace
                </h2>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                Your organization and workspace configuration.
              </p>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Organization
                </p>

                <p className="mt-2 font-medium">
                  {organization?.name ||
                    "No organization"}
                </p>
              </div>

              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Plan
                </p>

                <p className="mt-2 font-medium capitalize">
                  {organization?.plan ||
                    "Foundation"}
                </p>
              </div>

              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Industry
                </p>

                <p className="mt-2 font-medium">
                  {organization?.industry ||
                    "Technology"}
                </p>
              </div>

              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Website
                </p>

                <p className="mt-2 truncate font-medium">
                  {organization?.website ||
                    "Not configured"}
                </p>
              </div>
            </div>
          </section>

          {/* Regional */}
          <section className="rounded-2xl border bg-card shadow-sm">
            <div className="border-b p-5">
              <div className="flex items-center gap-2">
                <Clock3 className="h-5 w-5 text-muted-foreground" />

                <h2 className="font-semibold">
                  Regional settings
                </h2>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                Regional preferences used by the operating system.
              </p>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Timezone
                </p>

                <p className="mt-2 font-medium">
                  {organization?.timezone ||
                    "Africa/Lagos"}
                </p>
              </div>

              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Currency
                </p>

                <p className="mt-2 font-medium">
                  NGN
                </p>
              </div>
            </div>
          </section>

          {/* Notifications */}
          <section className="rounded-2xl border bg-card shadow-sm">
            <div className="border-b p-5">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-muted-foreground" />

                <h2 className="font-semibold">
                  Notifications
                </h2>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                Notification preferences for your workspace.
              </p>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
                <div>
                  <p className="font-medium">
                    Business alerts
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Receive alerts when important business events
                    occur.
                  </p>
                </div>

                <div className="rounded-full border bg-muted px-3 py-1 text-xs font-medium">
                  Coming soon
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
                <div>
                  <p className="font-medium">
                    AI recommendations
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Get notified when the system generates new
                    recommendations.
                  </p>
                </div>

                <div className="rounded-full border bg-muted px-3 py-1 text-xs font-medium">
                  Coming soon
                </div>
              </div>
            </div>
          </section>

          {/* Security */}
          <section className="rounded-2xl border bg-card shadow-sm">
            <div className="border-b p-5">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-muted-foreground" />

                <h2 className="font-semibold">
                  Security
                </h2>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                Manage your account access.
              </p>
            </div>

            <div className="p-5">
              <button
                type="button"
                onClick={signOut}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
