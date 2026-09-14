create table public.business_source_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_id uuid not null references public.business_data_sources(id) on delete cascade,
  record_key text not null,
  payload jsonb not null default '{}'::jsonb,
  recorded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source_id, record_key)
);
create table public.business_kpi_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_id uuid not null references public.business_data_sources(id) on delete cascade,
  field_name text not null,
  metric_name text not null,
  unit text not null default 'count',
  confirmed_at timestamptz not null default now(),
  unique (source_id, field_name)
);
create index business_source_records_org_idx on public.business_source_records(organization_id);
create index business_kpi_mappings_org_idx on public.business_kpi_mappings(organization_id);
alter table public.business_source_records enable row level security;
alter table public.business_kpi_mappings enable row level security;
create policy business_source_records_org on public.business_source_records for all to authenticated using (organization_id = (select p.organization_id from public.profiles p where p.id = auth.uid())) with check (organization_id = (select p.organization_id from public.profiles p where p.id = auth.uid()));
create policy business_kpi_mappings_org on public.business_kpi_mappings for all to authenticated using (organization_id = (select p.organization_id from public.profiles p where p.id = auth.uid())) with check (organization_id = (select p.organization_id from public.profiles p where p.id = auth.uid()));
