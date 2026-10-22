-- TechUnified Company Creation Layer
-- Foundation schema. Review with legal/accounting counsel before production use.

create table if not exists public.company_creation_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  company_name text,
  business_idea text not null,
  jurisdiction text,
  stage text not null default 'idea'
    check (stage in ('idea','agreement','identity','formation','infrastructure','launch','completed')),
  progress integer not null default 0 check (progress between 0 and 100),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_creation_agreements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.company_creation_projects(id) on delete cascade,
  version text not null,
  jurisdiction text,
  proposed_equity_percent numeric(5,2),
  terms_snapshot jsonb not null default '{}'::jsonb,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft','presented','accepted','superseded','void')),
  created_at timestamptz not null default now()
);

create table if not exists public.company_creation_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.company_creation_projects(id) on delete cascade,
  category text not null,
  title text not null,
  description text,
  status text not null default 'planned'
    check (status in ('planned','in_progress','awaiting_payment','completed','blocked')),
  provider_key text,
  external_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_creation_projects_org_idx on public.company_creation_projects(organization_id);
create index if not exists company_creation_agreements_project_idx on public.company_creation_agreements(project_id);
create index if not exists company_creation_tasks_project_idx on public.company_creation_tasks(project_id);

alter table public.company_creation_projects enable row level security;
alter table public.company_creation_agreements enable row level security;
alter table public.company_creation_tasks enable row level security;

-- Organization-membership policies will be added after aligning with the existing
-- TechUnified membership/RLS helpers. This avoids inventing a conflicting helper.
