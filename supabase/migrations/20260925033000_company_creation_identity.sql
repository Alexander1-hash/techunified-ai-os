-- Company Creation Identity & Availability Intelligence
-- Stores candidate identity ideas and explicitly separates suggestions from verified availability.

create table if not exists public.company_creation_identity_checks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.company_creation_projects(id) on delete cascade,
  proposed_name text,
  normalized_name text,
  domain_candidates jsonb not null default '[]'::jsonb,
  social_handles jsonb not null default '[]'::jsonb,
  verification_status text not null default 'not_verified'
    check (verification_status in ('not_verified','verified_available','verified_unavailable','needs_provider_check')),
  selected_name text,
  selected_domain text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists company_creation_identity_project_uidx
  on public.company_creation_identity_checks(project_id);

create index if not exists company_creation_identity_project_idx
  on public.company_creation_identity_checks(project_id);

alter table public.company_creation_identity_checks enable row level security;

create policy "company_creation_identity_select_org"
on public.company_creation_identity_checks
for select
to authenticated
using (
  exists (
    select 1
    from public.company_creation_projects p
    where p.id = company_creation_identity_checks.project_id
      and public.is_current_user_org_member(p.organization_id)
  )
);

create policy "company_creation_identity_insert_org"
on public.company_creation_identity_checks
for insert
to authenticated
with check (
  exists (
    select 1
    from public.company_creation_projects p
    where p.id = company_creation_identity_checks.project_id
      and public.is_current_user_org_member(p.organization_id)
  )
);

create policy "company_creation_identity_update_org"
on public.company_creation_identity_checks
for update
to authenticated
using (
  exists (
    select 1
    from public.company_creation_projects p
    where p.id = company_creation_identity_checks.project_id
      and public.is_current_user_org_member(p.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.company_creation_projects p
    where p.id = company_creation_identity_checks.project_id
      and public.is_current_user_org_member(p.organization_id)
  )
);
