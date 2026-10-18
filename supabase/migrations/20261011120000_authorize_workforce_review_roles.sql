-- Enforce recruitment permissions inside the database RPC as well as the API.
-- This migration is additive and safe to re-run.
create or replace function public.review_workforce_candidate_lead(
  p_candidate_id uuid,
  p_review_status text,
  p_reason text default null
)
returns table(candidate_id uuid, review_status text, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_organization_id uuid;
  v_actor_role text;
  v_vacancy_id uuid;
  v_old_status text;
  v_updated_at timestamptz;
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 1000), '');
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_review_status not in ('new', 'reviewing', 'shortlisted', 'not_progressing', 'withdrawn') then
    raise exception 'invalid_review_status' using errcode = '22023';
  end if;

  if p_review_status in ('not_progressing', 'withdrawn') and char_length(coalesce(v_reason, '')) < 3 then
    raise exception 'job_related_reason_required' using errcode = '22023';
  end if;

  select p.organization_id, p.role into v_organization_id, v_actor_role
  from public.profiles p where p.id = v_actor;

  if v_organization_id is null then
    raise exception 'organization_required' using errcode = '42501';
  end if;

  if coalesce(v_actor_role, '') not in ('owner', 'admin', 'organization_admin', 'recruiter', 'hiring_manager') then
    raise exception 'recruitment_role_required' using errcode = '42501';
  end if;

  select c.vacancy_id, c.review_status
    into v_vacancy_id, v_old_status
  from public.workforce_candidate_leads c
  join public.workforce_vacancies v
    on v.id = c.vacancy_id and v.organization_id = c.organization_id
  where c.id = p_candidate_id
    and c.organization_id = v_organization_id
  for update of c;

  if v_vacancy_id is null then
    raise exception 'candidate_not_found' using errcode = 'P0002';
  end if;

  update public.workforce_candidate_leads c
    set review_status = p_review_status
  where c.id = p_candidate_id and c.organization_id = v_organization_id
  returning c.updated_at into v_updated_at;

  insert into public.workforce_recruitment_events (
    organization_id, vacancy_id, candidate_lead_id, actor_id,
    event_type, from_status, to_status, reason, metadata
  ) values (
    v_organization_id, v_vacancy_id, p_candidate_id, v_actor,
    'candidate_review_status_changed', v_old_status, p_review_status,
    v_reason, jsonb_build_object('review_surface', 'workforce_workspace')
  );

  return query select p_candidate_id, p_review_status, v_updated_at;
end;
$function$;

revoke all on function public.review_workforce_candidate_lead(uuid, text, text) from public, anon;
grant execute on function public.review_workforce_candidate_lead(uuid, text, text) to authenticated;
