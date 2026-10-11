-- Universal workforce persistence foundation.
-- This migration is committed for review; it has NOT been executed against Supabase.
-- Candidate records are organization-scoped and must only be created after the
-- organization has documented a lawful basis/authorization for processing.

create table if not exists public.workforce_vacancies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 2 and 160),
  industry text not null check (char_length(trim(industry)) between 2 and 120),
  jurisdiction text not null check (char_length(trim(jurisdiction)) between 2 and 160),
  location_text text not null check (char_length(trim(location_text)) between 2 and 240),
  location_mode text not null default 'local'
    check (location_mode in ('local','region','country','worldwide','remote')),
  employment_type text not null default 'unspecified'
    check (employment_type in ('full_time','part_time','contract','temporary','internship','unspecified')),
  description text not null check (char_length(trim(description)) between 10 and 12000),
  requirements jsonb not null default '[]'::jsonb
    check (jsonb_typeof(requirements) = 'array'),
  required_licences jsonb not null default '[]'::jsonb
    check (jsonb_typeof(required_licences) = 'array'),
  processing_authorized boolean not null default false,
  authorization_reference text,
  status text not null default 'draft'
    check (status in ('draft','open','paused','filled','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not processing_authorized or nullif(trim(authorization_reference), '') is not null)
);

create table if not exists public.workforce_candidate_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  vacancy_id uuid not null references public.workforce_vacancies(id) on delete cascade,
  source_id text not null check (char_length(trim(source_id)) between 1 and 160),
  source_candidate_id text not null check (char_length(trim(source_candidate_id)) between 1 and 240),
  display_name text,
  profile_url text,
  location_text text,
  job_relevant_summary text,
  job_relevant_skills jsonb not null default '[]'::jsonb
    check (jsonb_typeof(job_relevant_skills) = 'array'),
  evidence_status text not null default 'unverified'
    check (evidence_status in ('unverified','needs_review','partially_verified','verified')),
  review_status text not null default 'new'
    check (review_status in ('new','reviewing','shortlisted','not_progressing','withdrawn')),
  retrieved_at timestamptz not null default now(),
  retention_review_at timestamptz not null default (now() + interval '90 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, vacancy_id, source_id, source_candidate_id),
  check (profile_url is null or profile_url ~* '^https?://'),
  check (display_name is null or char_length(display_name) <= 200),
  check (job_relevant_summary is null or char_length(job_relevant_summary) <= 1200),
  check (location_text is null or char_length(location_text) <= 240),
  check (retention_review_at >= retrieved_at)
);

create table if not exists public.workforce_recruitment_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  vacancy_id uuid not null references public.workforce_vacancies(id) on delete cascade,
  candidate_lead_id uuid references public.workforce_candidate_leads(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (char_length(trim(event_type)) between 2 and 100),
  from_status text,
  to_status text,
  reason text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default now()
);

create index if not exists workforce_vacancies_org_status_idx
  on public.workforce_vacancies (organization_id, status, created_at desc);
create index if not exists workforce_candidate_leads_org_vacancy_idx
  on public.workforce_candidate_leads (organization_id, vacancy_id, review_status);
create index if not exists workforce_candidate_leads_retention_idx
  on public.workforce_candidate_leads (retention_review_at);
create index if not exists workforce_recruitment_events_org_vacancy_idx
  on public.workforce_recruitment_events (organization_id, vacancy_id, occurred_at desc);

alter table public.workforce_vacancies enable row level security;
alter table public.workforce_candidate_leads enable row level security;
alter table public.workforce_recruitment_events enable row level security;

-- Users can only access vacancies and candidate leads belonging to their profile's
-- organization. The organization ID is never accepted from an untrusted client alone.
drop policy if exists workforce_vacancies_org_select on public.workforce_vacancies;
create policy workforce_vacancies_org_select on public.workforce_vacancies
  for select to authenticated using (
    organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid()))
  );
drop policy if exists workforce_vacancies_org_insert on public.workforce_vacancies;
create policy workforce_vacancies_org_insert on public.workforce_vacancies
  for insert to authenticated with check (
    organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid()))
    and created_by = (select auth.uid())
  );
drop policy if exists workforce_vacancies_org_update on public.workforce_vacancies;
create policy workforce_vacancies_org_update on public.workforce_vacancies
  for update to authenticated using (
    organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid()))
  ) with check (
    organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid()))
  );
drop policy if exists workforce_vacancies_org_delete on public.workforce_vacancies;
create policy workforce_vacancies_org_delete on public.workforce_vacancies
  for delete to authenticated using (
    organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid()))
  );

drop policy if exists workforce_candidate_leads_org_select on public.workforce_candidate_leads;
create policy workforce_candidate_leads_org_select on public.workforce_candidate_leads
  for select to authenticated using (
    organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid()))
  );
drop policy if exists workforce_candidate_leads_org_insert on public.workforce_candidate_leads;
create policy workforce_candidate_leads_org_insert on public.workforce_candidate_leads
  for insert to authenticated with check (
    organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid()))
    and exists (
      select 1 from public.workforce_vacancies v
      where v.id = vacancy_id and v.organization_id = workforce_candidate_leads.organization_id
        and v.processing_authorized = true and v.status = 'open'
    )
  );
drop policy if exists workforce_candidate_leads_org_update on public.workforce_candidate_leads;
create policy workforce_candidate_leads_org_update on public.workforce_candidate_leads
  for update to authenticated using (
    organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid()))
  ) with check (
    organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid()))
  );
drop policy if exists workforce_candidate_leads_org_delete on public.workforce_candidate_leads;
create policy workforce_candidate_leads_org_delete on public.workforce_candidate_leads
  for delete to authenticated using (
    organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid()))
  );

-- Audit events are readable within the organization. Inserts are reserved for
-- trusted server-side code/service role so browser clients cannot forge audit history.
drop policy if exists workforce_events_org_select on public.workforce_recruitment_events;
create policy workforce_events_org_select on public.workforce_recruitment_events
  for select to authenticated using (
    organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid()))
  );

-- Keep updated_at maintained without requiring a new global trigger function.
create or replace function public.workforce_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

drop trigger if exists workforce_vacancies_set_updated_at on public.workforce_vacancies;
create trigger workforce_vacancies_set_updated_at before update on public.workforce_vacancies
  for each row execute function public.workforce_set_updated_at();
drop trigger if exists workforce_candidate_leads_set_updated_at on public.workforce_candidate_leads;
create trigger workforce_candidate_leads_set_updated_at before update on public.workforce_candidate_leads
  for each row execute function public.workforce_set_updated_at();
