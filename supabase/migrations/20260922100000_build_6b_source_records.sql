-- Build 6B: normalized Business Brain source records
-- Stores imported CSV/XLSX rows with organization isolation.

create table public.business_source_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  source_id uuid not null references public.business_data_sources(id) on delete cascade,
  record_key text not null,
  payload jsonb not null default '{}'::jsonb,
  recorded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint business_source_records_source_record_key_unique
    unique (source_id, record_key)
);

create index business_source_records_organization_id_idx
  on public.business_source_records (organization_id);

create index business_source_records_source_id_idx
  on public.business_source_records (source_id);

create index business_source_records_recorded_at_idx
  on public.business_source_records (recorded_at);

create trigger business_source_records_set_updated_at
before update on public.business_source_records
for each row
execute function public.set_updated_at();

alter table public.business_source_records enable row level security;

create policy business_source_records_org_select
on public.business_source_records
for select
to authenticated
using (
  organization_id = (
    select p.organization_id
    from public.profiles p
    where p.id = (select auth.uid())
  )
);

create policy business_source_records_org_insert
on public.business_source_records
for insert
to authenticated
with check (
  organization_id = (
    select p.organization_id
    from public.profiles p
    where p.id = (select auth.uid())
  )
);

create policy business_source_records_org_update
on public.business_source_records
for update
to authenticated
using (
  organization_id = (
    select p.organization_id
    from public.profiles p
    where p.id = (select auth.uid())
  )
)
with check (
  organization_id = (
    select p.organization_id
    from public.profiles p
    where p.id = (select auth.uid())
  )
);

create policy business_source_records_org_delete
on public.business_source_records
for delete
to authenticated
using (
  organization_id = (
    select p.organization_id
    from public.profiles p
    where p.id = (select auth.uid())
  )
);
