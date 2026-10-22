-- Centralized, authenticated, user-scoped intelligence audit event storage.
-- Apply through the Supabase migration workflow before enabling this API in production.
create table if not exists public.intelligence_audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in (
    'run.started', 'run.completed', 'run.failed', 'incident.created',
    'incident.updated', 'governance.decision', 'snapshot.verified', 'system.note'
  )),
  source text not null check (char_length(source) between 1 and 100),
  severity text not null check (severity in ('info', 'warning', 'error', 'critical')),
  summary text not null check (char_length(summary) between 1 and 500),
  details jsonb not null default '{}'::jsonb check (pg_column_size(details) <= 4096),
  correlation_id text null check (correlation_id is null or char_length(correlation_id) <= 120),
  created_at timestamptz not null default now()
);

create index if not exists intelligence_audit_events_user_created_idx
  on public.intelligence_audit_events (user_id, created_at desc);
create index if not exists intelligence_audit_events_user_type_created_idx
  on public.intelligence_audit_events (user_id, event_type, created_at desc);

alter table public.intelligence_audit_events enable row level security;

drop policy if exists "Users can read their own intelligence audit events" on public.intelligence_audit_events;
create policy "Users can read their own intelligence audit events"
  on public.intelligence_audit_events for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can append their own intelligence audit events" on public.intelligence_audit_events;
create policy "Users can append their own intelligence audit events"
  on public.intelligence_audit_events for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- No UPDATE or DELETE policies are intentionally created. Authenticated users may
-- read their own rows and append new rows, but cannot edit or delete event history.
revoke all on public.intelligence_audit_events from anon;
grant select, insert on public.intelligence_audit_events to authenticated;
