"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Globe2,
  MapPin,
  Sparkles,
} from "lucide-react";

const industries = [
  "Technology",
  "Financial services",
  "Healthcare",
  "Retail",
  "Professional services",
  "Manufacturing",
  "Education",
  "Other",
];

const timezones = [
  "Africa/Lagos",
  "Africa/Cairo",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Singapore",
];

export function OrganizationOnboarding() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    description: "",
    industry: "",
    website: "",
    timezone: "Africa/Lagos",
  });

  const [state, setState] = useState<
    "idle" | "creating" | "error"
  >("idle");

  const [error, setError] = useState("");

  const update = (
    field: keyof typeof form,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  async function submit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setState("creating");
    setError("");

    try {
      const response = await fetch(
        "/api/onboarding/organization",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Company setup could not be completed.",
        );
      }

      router.replace("/workspace");
      router.refresh();
    } catch (submissionError) {
      setState("error");

      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Company setup could not be completed.",
      );
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-2rem)] items-center justify-center py-6 sm:min-h-[calc(100vh-4rem)] sm:py-10">
      <section className="w-full max-w-2xl rounded-2xl border bg-card p-5 shadow-sm sm:p-8">
        <div className="mb-8 flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles size={22} />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Company setup
            </p>

            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Let&apos;s set up your workspace
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Your company context will ground the AI workforce,
              Company Brain, and every organization-scoped session.
            </p>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="space-y-5"
          noValidate
        >
          <label className="block">
            <span className="mb-2 block text-sm font-medium">
              Company name{" "}
              <span className="text-primary">*</span>
            </span>

            <div className="flex items-center gap-3 rounded-xl border bg-background px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
              <Building2
                size={17}
                className="text-muted-foreground"
              />

              <input
                required
                maxLength={120}
                value={form.name}
                onChange={(event) =>
                  update("name", event.target.value)
                }
                placeholder="e.g. Acme Technologies"
                className="min-h-12 w-full bg-transparent text-sm outline-none"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium">
              Company description{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </span>

            <textarea
              maxLength={500}
              value={form.description}
              onChange={(event) =>
                update(
                  "description",
                  event.target.value,
                )
              }
              placeholder="Briefly describe what your company does"
              className="min-h-28 w-full resize-y rounded-xl border bg-background px-3 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium">
              Industry{" "}
              <span className="text-primary">*</span>
            </span>

            <select
              required
              value={form.industry}
              onChange={(event) =>
                update("industry", event.target.value)
              }
              className="min-h-12 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">
                Select your industry
              </option>

              {industries.map((industry) => (
                <option
                  key={industry}
                  value={industry}
                >
                  {industry}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium">
              Website{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </span>

            <div className="flex items-center gap-3 rounded-xl border bg-background px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
              <Globe2
                size={17}
                className="text-muted-foreground"
              />

              <input
                type="url"
                maxLength={300}
                value={form.website}
                onChange={(event) =>
                  update("website", event.target.value)
                }
                placeholder="https://yourcompany.com"
                className="min-h-12 w-full bg-transparent text-sm outline-none"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium">
              Timezone
            </span>

            <div className="flex items-center gap-3 rounded-xl border bg-background px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
              <MapPin
                size={17}
                className="text-muted-foreground"
              />

              <select
                value={form.timezone}
                onChange={(event) =>
                  update(
                    "timezone",
                    event.target.value,
                  )
                }
                className="min-h-12 w-full bg-transparent text-sm outline-none"
              >
                {timezones.map((timezone) => (
                  <option
                    key={timezone}
                    value={timezone}
                  >
                    {timezone}
                  </option>
                ))}
              </select>
            </div>
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={state === "creating"}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
          >
            {state === "creating"
              ? "Creating your workspace…"
              : "Create company workspace"}

            {state !== "creating" && (
              <ArrowRight size={17} />
            )}
          </button>
        </form>
      </section>
    </main>
  );
                    }
