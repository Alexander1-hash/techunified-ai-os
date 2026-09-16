-- Settings Foundation
-- Adds an organization description column plus user-owned settings tables
-- (AI preferences, notification preferences) and organization-scoped
-- integration connection persistence. Idempotent and RLS-protected.

-- ---------------------------------------------------------------------------
-- Organization description (used by /settings/organization)
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column if not exists description text;

-- ---------------------------------------------------------------------------
-- AI preferences (user-owned, scoped to auth.uid())
-- ---------------------------------------------------------------------------
create table if not exists public.ai_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  default_model text,
  response_style text,
  default_temperature numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Notification preferences (user-owned, scoped to auth.uid())
-- ---------------------------------------------------------------------------
create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  email_enabled boolean not null default true,
  product_updates boolean not null default true,
  workflow_alerts boolean not null default true,
  security_alerts boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Integration connections (organization-scoped persistence for real state)
-- ---------------------------------------------------------------------------
create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_id text not null,
  status text not null default 'connected',
  connected_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider_id)
);

create index if not exists ai_preferences_user_id_idx on public.ai_preferences(user_id);
create index if not exists notification_preferences_user_id_idx on public.notification_preferences(user_id);
create index if not exists integration_connections_organization_id_idx on public.integration_connections(organization_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers (reuses public.set_updated_at from the data foundation)
-- ---------------------------------------------------------------------------
do $$
declare
  target text;
begin
  foreach target in array array['ai_preferences','notification_preferences','integration_connections'] loop
    execute format('drop trigger if exists %I on public.%I', target || '_set_updated_at', target);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', target || '_set_updated_at', target);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.ai_preferences enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.integration_connections enable row level security;

-- AI preferences: users manage only their own row.
drop policy if exists ai_preferences_select_own on public.ai_preferences;
drop policy if exists ai_preferences_insert_own on public.ai_preferences;
drop policy if exists ai_preferences_update_own on public.ai_preferences;
drop policy if exists ai_preferences_delete_own on public.ai_preferences;
create policy ai_preferences_select_own on public.ai_preferences for select to authenticated using (user_id = (select auth.uid()));
create policy ai_preferences_insert_own on public.ai_preferences for insert to authenticated with check (user_id = (select auth.uid()));
create policy ai_preferences_update_own on public.ai_preferences for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy ai_preferences_delete_own on public.ai_preferences for delete to authenticated using (user_id = (select auth.uid()));

-- Notification preferences: users manage only their own row.
drop policy if exists notification_preferences_select_own on public.notification_preferences;
drop policy if exists notification_preferences_insert_own on public.notification_preferences;
drop policy if exists notification_preferences_update_own on public.notification_preferences;
drop policy if exists notification_preferences_delete_own on public.notification_preferences;
create policy notification_preferences_select_own on public.notification_preferences for select to authenticated using (user_id = (select auth.uid()));
create policy notification_preferences_insert_own on public.notification_preferences for insert to authenticated with check (user_id = (select auth.uid()));
create policy notification_preferences_update_own on public.notification_preferences for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notification_preferences_delete_own on public.notification_preferences for delete to authenticated using (user_id = (select auth.uid()));

-- Integration connections: readable by any org member, writable by org admins/owners.
drop policy if exists integration_connections_select_org on public.integration_connections;
drop policy if exists integration_connections_insert_org on public.integration_connections;
drop policy if exists integration_connections_update_org on public.integration_connections;
drop policy if exists integration_connections_delete_org on public.integration_connections;
create policy integration_connections_select_org on public.integration_connections for select to authenticated using (
  organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid()))
);
create policy integration_connections_insert_org on public.integration_connections for insert to authenticated with check (
  organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid()))
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('Owner','Admin'))
);
create policy integration_connections_update_org on public.integration_connections for update to authenticated using (
  organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid()))
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('Owner','Admin'))
) with check (
  organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid()))
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('Owner','Admin'))
);
create policy integration_connections_delete_org on public.integration_connections for delete to authenticated using (
  organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid()))
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('Owner','Admin'))
);

-- ---------------------------------------------------------------------------
-- Grants (RLS still governs row visibility; no access for anon)
-- ---------------------------------------------------------------------------
revoke all on public.ai_preferences, public.notification_preferences, public.integration_connections from anon;
grant select, insert, update, delete on public.ai_preferences to authenticated;
grant select, insert, update, delete on public.notification_preferences to authenticated;
grant select, insert, update, delete on public.integration_connections to authenticated;
