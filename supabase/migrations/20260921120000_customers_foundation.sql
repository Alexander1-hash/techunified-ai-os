-- TechUnified AI OS
-- Customers foundation

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  name text not null,
  email text,
  phone text,
  company_name text,

  status text not null default 'lead',
  source text,
  notes text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_organization_id_idx
  on public.customers(organization_id);

create index if not exists customers_status_idx
  on public.customers(organization_id, status);

create index if not exists customers_email_idx
  on public.customers(organization_id, email);

create index if not exists customers_created_at_idx
  on public.customers(organization_id, created_at desc);

create or replace function public.set_customers_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customers_set_updated_at
  on public.customers;

create trigger customers_set_updated_at
before update on public.customers
for each row
execute function public.set_customers_updated_at();

alter table public.customers
enable row level security;

drop policy if exists customers_org_select
  on public.customers;

create policy customers_org_select
on public.customers
for select
to authenticated
using (
  organization_id = (
    select p.organization_id
    from public.profiles p
    where p.id = (select auth.uid())
  )
);

drop policy if exists customers_org_insert
  on public.customers;

create policy customers_org_insert
on public.customers
for insert
to authenticated
with check (
  organization_id = (
    select p.organization_id
    from public.profiles p
    where p.id = (select auth.uid())
  )
);

drop policy if exists customers_org_update
  on public.customers;

create policy customers_org_update
on public.customers
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

drop policy if exists customers_org_delete
  on public.customers;

create policy customers_org_delete
on public.customers
for delete
to authenticated
using (
  organization_id = (
    select p.organization_id
    from public.profiles p
    where p.id = (select auth.uid())
  )
);

revoke all on public.customers from anon;

grant select, insert, update, delete
on public.customers
to authenticated;
