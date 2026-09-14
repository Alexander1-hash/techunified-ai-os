create table if not exists public.ai_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  prompt text not null,
  session_type text not null default 'session',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_sessions_organization_created_idx on public.ai_sessions(organization_id, created_at desc);
alter table public.ai_sessions enable row level security;
drop policy if exists ai_sessions_org_select on public.ai_sessions;
drop policy if exists ai_sessions_org_insert on public.ai_sessions;
drop policy if exists ai_sessions_org_update on public.ai_sessions;
create policy ai_sessions_org_select on public.ai_sessions for select to authenticated using (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));
create policy ai_sessions_org_insert on public.ai_sessions for insert to authenticated with check (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())) and created_by = (select auth.uid()));
create policy ai_sessions_org_update on public.ai_sessions for update to authenticated using (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid()))) with check (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));
grant select, insert, update on public.ai_sessions to authenticated;
create trigger ai_sessions_set_updated_at before update on public.ai_sessions for each row execute function public.set_updated_at();
