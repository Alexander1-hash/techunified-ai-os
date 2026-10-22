# Centralized Intelligence Audit Events

## What this delivers

The `/api/market-intelligence/audit-events` route provides an authenticated server API for appending and reading event records in Supabase Postgres. It uses the signed-in Supabase session and the caller's user-scoped row-level security policies; it does not use or expose the service-role key.

- `POST` appends a validated event.
- `GET` returns the current user's latest events (default 50, maximum 100); an optional `eventType` filter is supported.
- Event summaries, source labels, details, and correlation IDs have explicit size limits.
- Row-level security prevents users from reading or inserting rows for another user.
- No update/delete policy is provided, so normal authenticated clients cannot modify or delete stored events.
- The endpoint returns a clear 503 when the migration is missing or storage is not configured.

## Enablement

1. Apply `supabase/migrations/202610220001_intelligence_audit_events.sql` to the intended Supabase project using your normal migration/review process.
2. Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or the supported publishable key) are configured in Vercel.
3. Deploy the application, sign in, and test authenticated POST and GET requests.
4. Verify with two different test users that each user can only see their own events.

## Example

```http
POST /api/market-intelligence/audit-events
Content-Type: application/json

{
  "eventType": "system.note",
  "source": "intelligence-operations-center",
  "severity": "info",
  "summary": "Central audit storage connectivity verified",
  "details": { "mode": "readiness-check" },
  "correlationId": "ops-check-001"
}
```

Then call `GET /api/market-intelligence/audit-events?limit=25` with the same authenticated session.

## Important boundaries

This is an append-only application event log, not a cryptographically tamper-proof compliance ledger. Database owners/service-role operators can still change records, and retention, backup, alerting, and administrative audit policies must be configured at the Supabase project level. The API does not silently copy browser-local ledger data into the centralized store; migration/import must be designed and authorized separately. Existing browser-local history remains separate until an explicit migration flow is implemented.
