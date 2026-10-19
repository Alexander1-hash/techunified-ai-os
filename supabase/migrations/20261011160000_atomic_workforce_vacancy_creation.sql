-- Create vacancies and their initial audit event in one transaction.
-- Authenticated clients must use this RPC rather than inserting directly.
revoke insert on table public.workforce_vacancies from authenticated;
grant select on table public.workforce_vacancies to authenticated;

create or replace function public.create_workforce_vacancy(
  p_title text,
  p_industry text,
  p_jurisdiction text,
  p_location_text text,
  p_location_mode text,
  p_employment_type text,
  p_description text,
  p_requirements jsonb,
  p_required_licences jsonb,
  p_processing_authorized boolean,
  p_authorization_reference text,
  p_status text
)
returns setof public.workforce_vacancies
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_organization_id uuid;
  v_actor_role text;
  v_vacancy public.workforce_vacancies%rowtype;
  v_title text := trim(coalesce(p_title, ''));
  v_industry text := trim(coalesce(p_industry, ''));
  v_jurisdiction text := trim(coalesce(p_jurisdiction, ''));
  v_location_text text := trim(coalesce(p_location_text, ''));
  v_description text := trim(coalesce(p_description, ''));
  v_location_mode text := trim(coalesce(p_location_mode, ''));
  v_employment_type text := trim(coalesce(p_employment_type, ''));
  v_authorization_reference text := nullif(left(trim(coalesce(p_authorization_reference, '')), 500), '');
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select p.organization_id, p.role into v_organization_id, v_actor_role
  from public.profiles p where p.id = v_actor;

  if v_organization_id is null
     or coalesce(v_actor_role, '') not in ('owner', 'admin', 'organization_admin', 'recruiter', 'hiring_manager') then
    raise exception 'recruitment_role_required' using errcode = '42501';
  end if;

  if char_length(v_title) not between 2 and 160
     or char_length(v_industry) not between 2 and 120
     or char_length(v_jurisdiction) not between 2 and 160
     or char_length(v_location_text) not between 2 and 240
     or char_length(v_description) not between 10 and 12000 then
    raise exception 'invalid_vacancy_fields' using errcode = '22023';
  end if;

  if v_location_mode not in ('local', 'region', 'country', 'worldwide', 'remote')
     or v_employment_type not in ('full_time', 'part_time', 'contract', 'temporary', 'internship', 'unspecified')
     or p_status not in ('draft', 'open') then
    raise exception 'invalid_vacancy_options' using errcode = '22023';
  end if;

  if jsonb_typeof(p_requirements) is distinct from 'array'
     or jsonb_array_length(p_requirements) > 80
     or jsonb_typeof(p_required_licences) is distinct from 'array'
     or jsonb_array_length(p_required_licences) > 30 then
    raise exception 'invalid_vacancy_requirements' using errcode = '22023';
  end if;

  if coalesce(p_processing_authorized, false) and v_authorization_reference is null then
    raise exception 'authorization_reference_required' using errcode = '22023';
  end if;

  if p_status = 'open'
     and (coalesce(p_processing_authorized, false) is not true or v_authorization_reference is null) then
    raise exception 'documented_processing_authorization_required' using errcode = '42501';
  end if;

  insert into public.workforce_vacancies (
    organization_id, created_by, title, industry, jurisdiction, location_text,
    location_mode, employment_type, description, requirements, required_licences,
    processing_authorized, authorization_reference, status
  ) values (
    v_organization_id, v_actor, v_title, v_industry, v_jurisdiction, v_location_text,
    v_location_mode, v_employment_type, v_description, p_requirements, p_required_licences,
    coalesce(p_processing_authorized, false), v_authorization_reference, p_status
  ) returning * into v_vacancy;

  insert into public.workforce_recruitment_events (
    organization_id, vacancy_id, actor_id, event_type, from_status, to_status, reason, metadata
  ) values (
    v_organization_id, v_vacancy.id, v_actor, 'vacancy_created', null, v_vacancy.status, null,
    jsonb_build_object('creation_surface', 'workforce_workspace')
  );

  return next v_vacancy;
end;
$function$;

revoke all on function public.create_workforce_vacancy(
  text, text, text, text, text, text, text, jsonb, jsonb, boolean, text, text
) from public, anon;
grant execute on function public.create_workforce_vacancy(
  text, text, text, text, text, text, text, jsonb, jsonb, boolean, text, text
) to authenticated;
