# TechUnified AI OS

AI-powered business operating system with modular AI agents, company knowledge, automation, analytics, department management, and a provider-independent AI Studio.

## Build 5: AI Studio architecture

Vercel hosts the Next.js application and asynchronous generation API. Supabase stores generation metadata, private inputs, generated assets, credits, and ownership-scoped rows. When `AI_WORKER_URL` is absent, development mode uses a clearly labeled mock provider; when configured, the server sends jobs to the separate GPU worker using `AI_WORKER_SECRET`.

AI Studio supports video and image request contracts, polling, idempotency keys, server-side credit checks, generation history seams, and future model replacement without coupling the UI to an inference vendor. No Higgsfield integration, leaked credentials, or proprietary video-generation API is used.

### Environment

Copy `.env.example` into the deployment configuration. Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are browser-safe. `SUPABASE_SERVICE_ROLE_KEY`, `AI_WORKER_URL`, and `AI_WORKER_SECRET` are server-only; the current routes use the authenticated Supabase session and never expose those values.

### Mock mode

Leave `AI_WORKER_URL` empty, sign in, open `/studio`, submit a prompt, and use the returned generation ID with `/api/ai/generations/[id]`. The mock provider transitions from processing to completed and returns demo media; the UI labels the engine as Development mode.

### Future GPU worker

Deploy the planned worker separately with Python, PyTorch, Diffusers, CUDA, and a license-compliant open-weight model such as Wan2.1 where permitted. See `worker/README.md` for the planned `/generate`, `/status/:id`, and `/cancel/:id` contract. The worker should upload outputs to private Supabase Storage and return generation status to the Vercel API.

### Supabase

The Build 5 SQL migration creates `generations`, `generation_assets`, `generation_usage`, and `user_credits` with UUIDs, indexes, ownership RLS, and a unique per-user idempotency key. Apply the approved schema in the connected Supabase project before using production generation history or credit balances; create private `ai-inputs` and `ai-generations` Storage buckets with authenticated ownership policies.

### Security

Credits are checked server-side, generation ownership is filtered by authenticated user, and worker secrets never enter client bundles. Production should move credit reservation/refund into a single transactional Postgres function or server-only RPC before enabling paid usage.

### Supabase Auth URL configuration

For email confirmation and password recovery, configure the Supabase Auth Site URL as `https://techunified-ai-os.vercel.app` and allow the redirect URL `https://techunified-ai-os.vercel.app/auth/callback`. Set `NEXT_PUBLIC_SITE_URL=https://techunified-ai-os.vercel.app` in production. Signup and password reset then use `https://techunified-ai-os.vercel.app/auth/callback`. In development, when `NEXT_PUBLIC_SITE_URL` is unset, they use the current browser origin (for example `http://localhost:3000/auth/callback`). Production fails safely instead of generating a localhost or other development-host callback when the site URL is missing or invalid. Sessions are stored in Supabase SSR cookies; passwords and service-role credentials are never handled by the browser.


## Recruitment workspace: trusted candidate ingestion

The `/workforce` workspace and organization-scoped vacancy/review APIs provide the recruitment foundation. Live search is **not enabled by default**: an approved provider adapter must be implemented and configured separately. Do not describe the product as searching all online profiles until a real provider is connected and tested.

The server-only `POST /api/workforce/providers/ingest` endpoint is the controlled handoff for a permitted provider adapter:

- Set `WORKFORCE_INGESTION_SECRET` in Vercel to a unique random secret of at least 32 characters. Keep it server-side and do not prefix it with `NEXT_PUBLIC_`.
- Set `WORKFORCE_APPROVED_SOURCE_IDS` to a comma-separated allowlist of source IDs approved for use, for example `approved_provider_a,approved_provider_b`. These are identifiers, not provider integrations or credentials.
- The provider adapter must send `Authorization: Bearer <WORKFORCE_INGESTION_SECRET>` and JSON shaped like the example below. Send no more than 50 candidates and 128 KB per request.
- The vacancy must already be open and have documented processing authorization. `authorization_reference` must exactly match the value stored on that vacancy.
- Every ingested lead is stored as `unverified`; provider payloads cannot mark credentials as verified. Source candidate IDs are used for deduplication, and a 90-day retention review is set on ingestion.
- The API delegates persistence to `ingest_workforce_candidate_leads`, a `SECURITY DEFINER` database function executable only by `service_role`. Candidate upserts and corresponding audit events commit in one transaction; if the audit insert fails, the candidate changes roll back too.
- Apply `supabase/migrations/20261011130000_atomic_workforce_candidate_ingestion.sql` before using the revised ingestion endpoint. Until that migration is applied, ingestion returns a safe service-unavailable response rather than falling back to non-atomic writes.

Example request body (use fictitious sample data only in tests):

```json
{
  "vacancy_id": "00000000-0000-4000-8000-000000000001",
  "source_id": "approved_provider_a",
  "authorization_reference": "internal-authorization-record-123",
  "candidates": [
    {
      "source_candidate_id": "provider-stable-id-456",
      "display_name": "Sample Candidate",
      "profile_url": "https://example.com/profile/sample",
      "location_text": "Toronto, Canada",
      "summary": "Experience relevant to the published vacancy requirements.",
      "skills": ["licensed practice", "client communication"]
    }
  ]
}
```

This endpoint does not discover candidates by itself. A provider integration must use an approved API/access method, follow source terms and applicable privacy/employment law, minimize collected personal data, and never scrape behind access controls. The database migrations in `supabase/migrations/` must be applied and validated in the intended Supabase project before production use; a successful Vercel deployment alone does not apply migrations.


## Recruitment operations and candidate evidence

The recruitment workspace now supports local filtering of candidate leads by free-text terms and review status, plus a transparent literal-keyword coverage summary against vacancy requirements. This coverage is deliberately not a suitability score: it only shows whether exact requirement phrases appear in the source summary or listed skills. Missing mentions are not proof that a candidate lacks the skill. Required licences and credentials must be independently verified.

Candidate profile and audit access is restricted to designated recruitment roles in the application API. Candidate responses are organization/vacancy scoped and should be served without shared caching. The UI keeps human review in control; no candidate is automatically hired or rejected.

### Vacancy lifecycle

Apply `supabase/migrations/20261011140000_workforce_vacancy_lifecycle.sql` before using vacancy status actions. The `transition_workforce_vacancy_status` database RPC checks organization membership and recruitment role, requires documented processing authorization before opening a vacancy, rejects terminal-state transitions, and records the status change in the recruitment audit table within the same transaction.

The workspace supports pausing sourcing, reopening an authorized draft/paused vacancy, marking a role filled, and cancelling a role. Status-change reasons are recorded for pause, draft, filled and cancelled transitions. The lifecycle migration is committed to GitHub; it is not evidence that the migration has been applied to the connected Supabase database.


### Recruitment security hardening and retention review

Apply these additional migrations in timestamp order after the workforce persistence foundation and the earlier review/ingestion migrations:

- `20261011140000_workforce_vacancy_lifecycle.sql` — audited vacancy status transitions.
- `20261011150000_harden_workforce_vacancy_writes.sql` — restricts direct vacancy updates/deletes, requires recruitment roles for inserts, and enforces authorization on new open vacancies.
- `20261011160000_atomic_workforce_vacancy_creation.sql` — routes vacancy creation through a role-checked database RPC that creates the initial audit event atomically, then revokes direct authenticated inserts.

The workspace highlights candidate leads whose scheduled 90-day retention review is overdue or due within 14 days. This is a review reminder, not automatic deletion: an authorized organization representative must decide whether continued retention is necessary under the organization's retention schedule and applicable law, and document the outcome in its approved process. Confirm the intended Supabase project and test role/RLS behavior before enabling the workflow for real candidate data.

To record a retention decision directly in the workspace, apply `supabase/migrations/20261011170000_workforce_retention_review.sql`. The candidate card's **Record retention review** action requires a documented reason and schedules the next review in 30, 60, 90, or 180 days. The database function checks the authenticated user's organization and recruitment role, updates the review date, and appends the audit event atomically. This records a decision to continue retaining the record; it does not delete candidate data or establish that retention is legally justified. Review the policy and data-subject obligations before choosing an interval.
