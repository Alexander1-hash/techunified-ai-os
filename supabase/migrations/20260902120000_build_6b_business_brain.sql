-- Build 6B: persistent, organization-scoped Business Brain foundation
-- Review only. This migration has not been executed against Supabase.

create table public.company_objectives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  target numeric,
  current_value numeric,
  deadline date,
  status text not null default 'active',
  owner_department_id uuid references public.departments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_kpis (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  category text not null,
  value numeric,
  previous_value numeric,
  target numeric,
  unit text,
  period text,
  trend text,
  status text,
  source text,
  recorded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_insights (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text not null,
  category text,
  severity text,
  confidence numeric,
  insight_type text not null,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_recommendations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  problem text,
  recommended_action text not null,
  priority text,
  expected_impact text,
  effort text,
  risk text,
  confidence numeric,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  report_type text not null,
  content text not null,
  period text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_data_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  provider text not null,
  category text not null,
  status text not null default 'not_connected',
  configuration_metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index company_objectives_organization_id_idx on public.company_objectives (organization_id);
create index business_kpis_organization_id_idx on public.business_kpis (organization_id);
create index business_insights_organization_id_idx on public.business_insights (organization_id);
create index business_recommendations_organization_id_idx on public.business_recommendations (organization_id);
create index business_reports_organization_id_idx on public.business_reports (organization_id);
create index business_data_sources_organization_id_idx on public.business_data_sources (organization_id);

-- Reuse an existing compatible public.set_updated_at() trigger function if present.
-- Otherwise create a minimal, non-security-definer fallback.
do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'set_updated_at'
      and pg_get_function_identity_arguments(p.oid) = ''
  ) then
    create function public.set_updated_at()
    returns trigger
    language plpgsql
    set search_path = public
    as $function$
    begin
      new.updated_at = now();
      return new;
    end;
    $function$;
  end if;
end
$$;

create trigger company_objectives_set_updated_at before update on public.company_objectives for each row execute function public.set_updated_at();
create trigger business_kpis_set_updated_at before update on public.business_kpis for each row execute function public.set_updated_at();
create trigger business_insights_set_updated_at before update on public.business_insights for each row execute function public.set_updated_at();
create trigger business_recommendations_set_updated_at before update on public.business_recommendations for each row execute function public.set_updated_at();
create trigger business_reports_set_updated_at before update on public.business_reports for each row execute function public.set_updated_at();
create trigger business_data_sources_set_updated_at before update on public.business_data_sources for each row execute function public.set_updated_at();

alter table public.company_objectives enable row level security;
alter table public.business_kpis enable row level security;
alter table public.business_insights enable row level security;
alter table public.business_recommendations enable row level security;
alter table public.business_reports enable row level security;
alter table public.business_data_sources enable row level security;

create policy company_objectives_org_select on public.company_objectives
  for select to authenticated
  using (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));
create policy company_objectives_org_insert on public.company_objectives
  for insert to authenticated
  with check (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));
create policy company_objectives_org_update on public.company_objectives
  for update to authenticated
  using (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())))
  with check (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));
create policy company_objectives_org_delete on public.company_objectives
  for delete to authenticated
  using (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));

create policy business_kpis_org_select on public.business_kpis
  for select to authenticated
  using (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));
create policy business_kpis_org_insert on public.business_kpis
  for insert to authenticated
  with check (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));
create policy business_kpis_org_update on public.business_kpis
  for update to authenticated
  using (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())))
  with check (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));
create policy business_kpis_org_delete on public.business_kpis
  for delete to authenticated
  using (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));

create policy business_insights_org_select on public.business_insights
  for select to authenticated
  using (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));
create policy business_insights_org_insert on public.business_insights
  for insert to authenticated
  with check (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));
create policy business_insights_org_update on public.business_insights
  for update to authenticated
  using (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())))
  with check (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));
create policy business_insights_org_delete on public.business_insights
  for delete to authenticated
  using (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));

create policy business_recommendations_org_select on public.business_recommendations
  for select to authenticated
  using (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));
create policy business_recommendations_org_insert on public.business_recommendations
  for insert to authenticated
  with check (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));
create policy business_recommendations_org_update on public.business_recommendations
  for update to authenticated
  using (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())))
  with check (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));
create policy business_recommendations_org_delete on public.business_recommendations
  for delete to authenticated
  using (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));

create policy business_reports_org_select on public.business_reports
  for select to authenticated
  using (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));
create policy business_reports_org_insert on public.business_reports
  for insert to authenticated
  with check (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));
create policy business_reports_org_update on public.business_reports
  for update to authenticated
  using (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())))
  with check (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));
create policy business_reports_org_delete on public.business_reports
  for delete to authenticated
  using (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));

create policy business_data_sources_org_select on public.business_data_sources
  for select to authenticated
  using (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));
create policy business_data_sources_org_insert on public.business_data_sources
  for insert to authenticated
  with check (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));
create policy business_data_sources_org_update on public.business_data_sources
  for update to authenticated
  using (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())))
  with check (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));
create policy business_data_sources_org_delete on public.business_data_sources
  for delete to authenticated
  using (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));
