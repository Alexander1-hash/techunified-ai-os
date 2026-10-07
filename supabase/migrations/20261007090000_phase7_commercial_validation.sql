-- Phase 7: Commercial validation and outcome evidence foundation
-- Captures pilot baselines, measurement periods, and verified before/after evidence.
-- This layer does not manufacture ROI; calculations remain evidence-backed.

create table if not exists public.business_pilot_validations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  objective_id uuid references public.company_objectives(id) on delete set null,
  name text not null,
  status text not null default 'planning'
    check (status in ('planning','active','paused','completed','cancelled')),
  baseline_start date,
  baseline_end date,
  deployment_start date,
  measurement_start date,
  measurement_end date,
  success_criteria jsonb not null default '[]'::jsonb,
  scope jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_pilot_measurements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  pilot_id uuid not null references public.business_pilot_validations(id) on delete cascade,
  metric_name text not null,
  metric_type text not null
    check (metric_type in ('baseline','during','after')),
  value numeric,
  unit text,
  period_start date,
  period_end date,
  source text,
  evidence_status text not null default 'unverified'
    check (evidence_status in ('unverified','observed','measured','attributed')),
  evidence jsonb not null default '{}'::jsonb,
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.business_pilot_roi_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  pilot_id uuid not null references public.business_pilot_validations(id) on delete cascade,
  baseline_measurement_id uuid references public.business_pilot_measurements(id) on delete set null,
  after_measurement_id uuid references public.business_pilot_measurements(id) on delete set null,
  metric_name text not null,
  baseline_value numeric,
  after_value numeric,
  delta_value numeric,
  delta_percent numeric,
  hours_saved numeric,
  cost_avoided numeric,
  revenue_impact numeric,
  currency text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending','verified','rejected')),
  methodology text,
  evidence jsonb not null default '{}'::jsonb,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_pilot_validations_org_idx
  on public.business_pilot_validations (organization_id, created_at desc);
create index if not exists business_pilot_measurements_pilot_idx
  on public.business_pilot_measurements (organization_id, pilot_id, recorded_at desc);
create index if not exists business_pilot_roi_evidence_pilot_idx
  on public.business_pilot_roi_evidence (organization_id, pilot_id, created_at desc);

alter table public.business_pilot_validations enable row level security;
alter table public.business_pilot_measurements enable row level security;
alter table public.business_pilot_roi_evidence enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_pilot_validations' and policyname='business_pilot_validations_org_all') then
    create policy business_pilot_validations_org_all on public.business_pilot_validations
      for all to authenticated
      using (organization_id = (select p.organization_id from public.profiles p where p.id = auth.uid()))
      with check (organization_id = (select p.organization_id from public.profiles p where p.id = auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_pilot_measurements' and policyname='business_pilot_measurements_org_all') then
    create policy business_pilot_measurements_org_all on public.business_pilot_measurements
      for all to authenticated
      using (organization_id = (select p.organization_id from public.profiles p where p.id = auth.uid()))
      with check (organization_id = (select p.organization_id from public.profiles p where p.id = auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_pilot_roi_evidence' and policyname='business_pilot_roi_evidence_org_all') then
    create policy business_pilot_roi_evidence_org_all on public.business_pilot_roi_evidence
      for all to authenticated
      using (organization_id = (select p.organization_id from public.profiles p where p.id = auth.uid()))
      with check (organization_id = (select p.organization_id from public.profiles p where p.id = auth.uid()));
  end if;
end
$$;

create or replace function public.set_business_pilot_validation_updated_at()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

drop trigger if exists business_pilot_validations_set_updated_at
  on public.business_pilot_validations;
create trigger business_pilot_validations_set_updated_at
  before update on public.business_pilot_validations
  for each row execute function public.set_business_pilot_validation_updated_at();

drop trigger if exists business_pilot_roi_evidence_set_updated_at
  on public.business_pilot_roi_evidence;
create trigger business_pilot_roi_evidence_set_updated_at
  before update on public.business_pilot_roi_evidence
  for each row execute function public.set_business_pilot_validation_updated_at();
