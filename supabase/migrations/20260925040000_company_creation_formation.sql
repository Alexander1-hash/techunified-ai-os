-- Company Creation Formation Intelligence
-- Stores a planning assessment separately from any official registration.

create table if not exists public.company_creation_formation_assessments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.company_creation_projects(id) on delete cascade,
  jurisdiction text not null,
  entity_path text,
  recommendation_status text not null default 'planning_only'
    check (recommendation_status in ('planning_only','needs_user_choice','needs_professional_review','ready_for_provider')),
  checklist jsonb not null default '[]'::jsonb,
  regulatory_flags jsonb not null default '[]'::jsonb,
  official_links jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists company_creation_formation_project_uidx
  on public.company_creation_formation_assessments(project_id);

alter table public.company_creation_formation_assessments enable row level security;

create policy "company_creation_formation_select_org"
on public.company_creation_formation_assessments
for select to authenticated
using (
  exists (
    select 1 from public.company_creation_projects p
    where p.id = company_creation_formation_assessments.project_id
      and public.is_current_user_org_member(p.organization_id)
  )
);

create policy "company_creation_formation_insert_org"
on public.company_creation_formation_assessments
for insert to authenticated
with check (
  exists (
    select 1 from public.company_creation_projects p
    where p.id = company_creation_formation_assessments.project_id
      and public.is_current_user_org_member(p.organization_id)
  )
);

create policy "company_creation_formation_update_org"
on public.company_creation_formation_assessments
for update to authenticated
using (
  exists (
    select 1 from public.company_creation_projects p
    where p.id = company_creation_formation_assessments.project_id
      and public.is_current_user_org_member(p.organization_id)
  )
)
with check (
  exists (
    select 1 from public.company_creation_projects p
    where p.id = company_creation_formation_assessments.project_id
      and public.is_current_user_org_member(p.organization_id)
  )
);
