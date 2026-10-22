-- Accelerate user-scoped incident/event correlation lookups.
-- Safe to apply after 202610220001_intelligence_audit_events.sql.
create index if not exists intelligence_audit_events_user_correlation_created_idx
  on public.intelligence_audit_events (user_id, correlation_id, created_at desc)
  where correlation_id is not null;
