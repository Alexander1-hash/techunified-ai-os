-- TechUnified AI OS
-- Sales foundation

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  customer_id uuid
    references public.customers(id)
    on delete set null,

  service_id uuid
    references public.services(id)
    on delete set null,

  amount numeric not null default 0,
  currency text not null default 'NGN',

  quantity integer not null default 1,

  status text not null default 'pending',
  payment_status text not null default 'unpaid',

  sale_date timestamptz not null default now(),

  notes text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint sales_quantity_positive
    check (quantity > 0),

  constraint sales_amount_non_negative
    check (amount >= 0),

  constraint sales_status_valid
    check (
      status in (
        'draft',
        'pending',
        'won',
        'lost',
        'cancelled'
      )
    ),

  constraint sales_payment_status_valid
    check (
      payment_status in (
        'unpaid',
        'partial',
        'paid',
        'refunded'
      )
    )
);

create index if not exists sales_organization_id_idx
  on public.sales(organization_id);

create index if not exists sales_customer_id_idx
  on public.sales(organization_id, customer_id);

create index if not exists sales_service_id_idx
  on public.sales(organization_id, service_id);

create index if not exists sales_status_idx
  on public.sales(organization_id, status);

create index if not exists sales_payment_status_idx
  on public.sales(organization_id, payment_status);

create index if not exists sales_sale_date_idx
  on public.sales(organization_id, sale_date desc);


create or replace function public.set_sales_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


drop trigger if exists sales_set_updated_at
  on public.sales;

create trigger sales_set_updated_at
before update on public.sales
for each row
execute function public.set_sales_updated_at();


alter table public.sales
enable row level security;


drop policy if exists sales_org_select
  on public.sales;

create policy sales_org_select
on public.sales
for select
to authenticated
using (
  organization_id = (
    select p.organization_id
    from public.profiles p
    where p.id = (select auth.uid())
  )
);


drop policy if exists sales_org_insert
  on public.sales;

create policy sales_org_insert
on public.sales
for insert
to authenticated
with check (
  organization_id = (
    select p.organization_id
    from public.profiles p
    where p.id = (select auth.uid())
  )
);


drop policy if exists sales_org_update
  on public.sales;

create policy sales_org_update
on public.sales
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


drop policy if exists sales_org_delete
  on public.sales;

create policy sales_org_delete
on public.sales
for delete
to authenticated
using (
  organization_id = (
    select p.organization_id
    from public.profiles p
    where p.id = (select auth.uid())
  )
);


revoke all on public.sales from anon;

grant select, insert, update, delete
on public.sales
to authenticated;
