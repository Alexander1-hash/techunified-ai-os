# Correlated Incident Timeline

## Purpose

The centralized audit API supports a correlation ID on every event. Use one stable, non-sensitive identifier (for example, `incident-2026-10-22-ops-01`) across related incident creation, investigation, mitigation, and resolution notes. The Operations Center can filter stored events by this identifier to show the related timeline.

## API

- Append an event with `correlationId` using authenticated `POST /api/market-intelligence/audit-events`.
- Retrieve a timeline with `GET /api/market-intelligence/audit-events?limit=100&correlationId=incident-2026-10-22-ops-01`.
- The correlation ID is case-sensitive, limited to 120 characters, and is not a secret or an authorization token.
- Results remain restricted to the signed-in user's records by Supabase RLS. Correlation IDs do not grant access to other users' events.
- A composite index supports user-scoped timeline retrieval. Apply `supabase/migrations/202610220002_audit_correlation_index.sql` after the original audit table migration.

## Incident handling practice

1. Create a unique correlation ID for a single incident or operational investigation.
2. Append concise events as the situation evolves; include severity and source consistently.
3. Record detection, triage, mitigation, and resolution as separate events rather than rewriting old entries.
4. Filter by the same ID to review the chronology and export/share only after checking for sensitive details.

## Boundaries

This is an event timeline, not an automated alerting or incident-remediation service. It cannot prove that every incident is recorded, and it does not change the reliability score or create incident tickets. The database migration must be applied and authenticated requests tested before centralized persistence can be considered enabled. Privileged database operators can still alter data; this is not tamper-proof compliance evidence.
