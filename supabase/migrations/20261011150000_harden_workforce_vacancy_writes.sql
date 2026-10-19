-- Prevent direct authenticated status edits/deletes that bypass the atomic lifecycle RPC.
-- Keep organization-scoped reads and controlled inserts; updates must use the audited RPC.
revoke update, delete on table public.workforce_vacancies from authenticated;
grant select, insert on table public.workforce_vacancies to authenticated;

drop policy if exists workforce_vacancies_org_insert on public.workforce_vacancies;
create policy workforce_vacancies_org_insert on public.workforce_vacancies
  for insert to authenticated with check (
    organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid()))
    and created_by = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and coalesce(p.role, '') in ('owner', 'admin', 'organization_admin', 'recruiter', 'hiring_manager')
    )
  );

-- New or changed records may not be opened unless processing authorization and
-- its reference are present. NOT VALID avoids blocking rollout if legacy rows
-- need review; PostgreSQL still enforces this constraint for new writes.
do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workforce_vacancy_open_requires_authorization'
      and conrelid = 'public.workforce_vacancies'::regclass
  ) then
    alter table public.workforce_vacancies
      add constraint workforce_vacancy_open_requires_authorization
      check (
        status <> 'open'
        or (
          processing_authorized = true
          and nullif(trim(authorization_reference), '') is not null
        )
      ) not valid;
  end if;
end;
$migration$;

comment on constraint workforce_vacancy_open_requires_authorization on public.workforce_vacancies
  is 'Prevents opening a vacancy without documented candidate-processing authorization.';
