create table if not exists public.automation_executions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  trigger_type text not null,
  status text not null default 'running',
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.automation_execution_steps (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.automation_executions(id) on delete cascade,
  step_id text not null,
  step_type text not null,
  status text not null default 'running',
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists automation_executions_organization_id_idx
  on public.automation_executions(organization_id);

create index if not exists automation_executions_workflow_id_idx
  on public.automation_executions(workflow_id);

create index if not exists automation_execution_steps_execution_id_idx
  on public.automation_execution_steps(execution_id);

alter table public.automation_executions enable row level security;
alter table public.automation_execution_steps enable row level security;

create policy automation_executions_org_select
on public.automation_executions
for select
to authenticated
using (
  organization_id = (
    select p.organization_id
    from public.profiles p
    where p.id = (select auth.uid())
  )
);

create policy automation_execution_steps_org_select
on public.automation_execution_steps
for select
to authenticated
using (
  execution_id in (
    select ae.id
    from public.automation_executions ae
    where ae.organization_id = (
      select p.organization_id
      from public.profiles p
      where p.id = (select auth.uid())
    )
  )
);

revoke all on public.automation_executions,
  public.automation_execution_steps
from anon;

grant select on public.automation_executions,
  public.automation_execution_steps
to authenticated;
