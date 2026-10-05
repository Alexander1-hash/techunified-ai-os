-- TechUnified AI OS
-- Phase 5: Business Relationship Intelligence
-- Connect existing business entities without replacing the existing CRUD/data model.

create table if not exists public.business_relationships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  relationship_type text not null,
  target_type text not null,
  target_id uuid not null,
  evidence_status text not null default 'verified',
  confidence numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint business_relationships_entity_type_check
    check (
      source_type in ('customer','sale','service','department','workflow','automation_execution','outcome')
      and target_type in ('customer','sale','service','department','workflow','automation_execution','outcome')
    ),
  constraint business_relationships_status_check
    check (evidence_status in ('verified','estimated','inferred')),
  constraint business_relationships_confidence_check
    check (confidence is null or (confidence >= 0 and confidence <= 1)),
  constraint business_relationships_not_self_check
    check (source_type <> target_type or source_id <> target_id)
);

create unique index if not exists business_relationships_unique_idx
  on public.business_relationships(
    organization_id, source_type, source_id,
    relationship_type, target_type, target_id
  );

create index if not exists business_relationships_source_idx
  on public.business_relationships(organization_id, source_type, source_id);

create index if not exists business_relationships_target_idx
  on public.business_relationships(organization_id, target_type, target_id);

create index if not exists business_relationships_type_idx
  on public.business_relationships(organization_id, relationship_type);

alter table public.business_relationships enable row level security;

drop policy if exists business_relationships_org_select on public.business_relationships;
create policy business_relationships_org_select
on public.business_relationships
for select to authenticated
using (
  organization_id = (
    select p.organization_id from public.profiles p
    where p.id = (select auth.uid())
  )
);

drop policy if exists business_relationships_org_insert on public.business_relationships;
create policy business_relationships_org_insert
on public.business_relationships
for insert to authenticated
with check (
  organization_id = (
    select p.organization_id from public.profiles p
    where p.id = (select auth.uid())
  )
);

drop policy if exists business_relationships_org_delete on public.business_relationships;
create policy business_relationships_org_delete
on public.business_relationships
for delete to authenticated
using (
  organization_id = (
    select p.organization_id from public.profiles p
    where p.id = (select auth.uid())
  )
);

revoke all on public.business_relationships from anon;
grant select, insert, delete on public.business_relationships to authenticated;

create index if not exists sales_customer_service_idx
  on public.sales(organization_id, customer_id, service_id);

create index if not exists services_department_idx
  on public.services(organization_id, department_id);

create index if not exists automation_executions_workflow_status_idx
  on public.automation_executions(organization_id, workflow_id, status);

create index if not exists business_outcomes_period_idx
  on public.business_outcomes(organization_id, period_start, period_end);
