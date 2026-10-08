import Link from "next/link"
import { ArrowRight, FileText, Scale } from "lucide-react"
import { LEGAL_POLICIES, LEGAL_VERSION } from "@/lib/legal-policies"

export default function LegalHubPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl border bg-card">
            <Scale className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              TechUnified AI OS
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Legal & policies
            </h1>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border bg-card p-5 sm:p-6">
          <p className="text-sm leading-6 text-muted-foreground">
            These policies describe how TechUnified AI OS is intended to operate for users and organizations. Each document has a version and effective date so policy changes can be communicated and tracked consistently.
          </p>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Current published version: {LEGAL_VERSION}. These documents are product-policy drafts and should receive qualified legal review before being treated as final legal agreements for a particular jurisdiction or commercial relationship.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {LEGAL_POLICIES.map((policy) => (
            <Link
              key={policy.slug}
              href={`/legal/${policy.slug}`}
              className="group rounded-2xl border bg-card p-5 transition hover:bg-muted/40"
            >
              <div className="flex items-start gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-background">
                  <FileText className="size-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{policy.shortTitle}</h2>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    {policy.summary}
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-xs font-medium text-muted-foreground group-hover:text-foreground">
                    Read policy
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Version {LEGAL_VERSION} · Effective October 8, 2026
        </p>
      </div>
    </div>
  )
}
