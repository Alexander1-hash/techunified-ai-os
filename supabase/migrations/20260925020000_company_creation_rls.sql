-- Company Creation Layer: organization-scoped RLS.
-- Non-destructive: creates/replaces only this feature's helper and policies.

create or replace function public.is_current_user_org_member(target_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_catalog
stable
as $$
  select exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.organization_id = target_organization_id
  );
$$;

revoke all on function public.is_current_user_org_member(uuid) from public;
grant execute on function public.is_current_user_org_member(uuid) to authenticated;

drop policy if exists "company creation projects select" on public.company_creation_projects;
create policy "company creation projects select" on public.company_creation_projects
for select to authenticated using (public.is_current_user_org_member(organization_id));

drop policy if exists "company creation projects insert" on public.company_creation_projects;
create policy "company creation projects insert" on public.company_creation_projects
for insert to authenticated
with check (created_by = auth.uid() and public.is_current_user_org_member(organization_id));

drop policy if exists "company creation projects update" on public.company_creation_projects;
create policy "company creation projects update" on public.company_creation_projects
for update to authenticated
using (public.is_current_user_org_member(organization_id))
with check (public.is_current_user_org_member(organization_id));

drop policy if exists "company creation agreements select" on public.company_creation_agreements;
create policy "company creation agreements select" on public.company_creation_agreements
for select to authenticated using (
  exists (select 1 from public.company_creation_projects p
    where p.id = project_id and public.is_current_user_org_member(p.organization_id))
);

drop policy if exists "company creation agreements insert" on public.company_creation_agreements;
create policy "company creation agreements insert" on public.company_creation_agreements
for insert to authenticated with check (
  exists (select 1 from public.company_creation_projects p
    where p.id = project_id and public.is_current_user_org_member(p.organization_id))
);

drop policy if exists "company creation agreements update" on public.company_creation_agreements;
create policy "company creation agreements update" on public.company_creation_agreements
for update to authenticated using (
  exists (select 1 from public.company_creation_projects p
    where p.id = project_id and public.is_current_user_org_member(p.organization_id))
) with check (
  exists (select 1 from public.company_creation_projects p
    where p.id = project_id and public.is_current_user_org_member(p.organization_id))
);

drop policy if exists "company creation tasks select" on public.company_creation_tasks;
create policy "company creation tasks select" on public.company_creation_tasks
for select to authenticated using (
  exists (select 1 from public.company_creation_projects p
    where p.id = project_id and public.is_current_user_org_member(p.organization_id))
);

drop policy if exists "company creation tasks insert" on public.company_creation_tasks;
create policy "company creation tasks insert" on public.company_creation_tasks
for insert to authenticated with check (
  exists (select 1 from public.company_creation_projects p
    where p.id = project_id and public.is_current_user_org_member(p.organization_id))
);

drop policy if exists "company creation tasks update" on public.company_creation_tasks;
create policy "company creation tasks update" on public.company_creation_tasks
for update to authenticated using (
  exists (select 1 from public.company_creation_projects p
    where p.id = project_id and public.is_current_user_org_member(p.organization_id))
) with check (
  exists (select 1 from public.company_creation_projects p
    where p.id = project_id and public.is_current_user_org_member(p.organization_id))
);
