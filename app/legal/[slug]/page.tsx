import Link from "next/link"
import { ArrowLeft, CalendarDays, Scale } from "lucide-react"
import { notFound } from "next/navigation"
import { getLegalPolicy, LEGAL_POLICIES } from "@/lib/legal-policies"

export function generateStaticParams() {
  return LEGAL_POLICIES.map((policy) => ({ slug: policy.slug }))
}

export default async function LegalPolicyPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const policy = getLegalPolicy(slug)

  if (!policy) notFound()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/legal"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to legal & policies
        </Link>

        <article className="mt-6 overflow-hidden rounded-2xl border bg-card">
          <header className="border-b p-5 sm:p-8">
            <div className="flex size-11 items-center justify-center rounded-xl border bg-background">
              <Scale className="size-5 text-primary" />
            </div>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">
              {policy.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {policy.summary}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span>Version {policy.version}</span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-3.5" />
                Effective {policy.effectiveDate}
              </span>
            </div>
          </header>

          <div className="space-y-8 p-5 sm:p-8">
            {policy.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-base font-semibold">{section.heading}</h2>
                <div className="mt-3 space-y-3">
                  {section.paragraphs.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="text-sm leading-7 text-muted-foreground"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <footer className="border-t bg-muted/20 px-5 py-4 text-xs leading-5 text-muted-foreground sm:px-8">
            Policy version {policy.version}. Future revisions will receive a new version and effective date.
          </footer>
        </article>
      </div>
    </div>
  )
}
