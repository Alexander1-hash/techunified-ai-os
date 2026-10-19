-- Human-documented candidate retention decisions.
-- Apply after the workforce persistence foundation and recruitment security migrations.
create or replace function public.review_workforce_candidate_retention(
  p_candidate_id uuid,
  p_reason text,
  p_review_interval_days integer default 90
)
returns table(candidate_id uuid, retention_review_at timestamptz, reviewed_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_organization_id uuid;
  v_actor_role text;
  v_vacancy_id uuid;
  v_old_review_at timestamptz;
  v_next_review_at timestamptz;
  v_reviewed_at timestamptz := now();
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 1000), '');
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_review_interval_days not in (30, 60, 90, 180) then
    raise exception 'invalid_review_interval' using errcode = '22023';
  end if;

  if char_length(coalesce(v_reason, '')) < 3 then
    raise exception 'retention_review_reason_required' using errcode = '22023';
  end if;

  select p.organization_id, p.role into v_organization_id, v_actor_role
  from public.profiles p where p.id = v_actor;

  if v_organization_id is null
    or coalesce(v_actor_role, '') not in ('owner', 'admin', 'organization_admin', 'recruiter', 'hiring_manager') then
    raise exception 'recruitment_role_required' using errcode = '42501';
  end if;

  select c.vacancy_id, c.retention_review_at
    into v_vacancy_id, v_old_review_at
  from public.workforce_candidate_leads c
  join public.workforce_vacancies v
    on v.id = c.vacancy_id and v.organization_id = c.organization_id
  where c.id = p_candidate_id and c.organization_id = v_organization_id
  for update of c;

  if v_vacancy_id is null then
    raise exception 'candidate_not_found' using errcode = 'P0002';
  end if;

  v_next_review_at := v_reviewed_at + make_interval(days => p_review_interval_days);

  update public.workforce_candidate_leads c
    set retention_review_at = v_next_review_at
  where c.id = p_candidate_id and c.organization_id = v_organization_id;

  insert into public.workforce_recruitment_events (
    organization_id, vacancy_id, candidate_lead_id, actor_id,
    event_type, from_status, to_status, reason, metadata
  ) values (
    v_organization_id, v_vacancy_id, p_candidate_id, v_actor,
    'candidate_retention_reviewed', v_old_review_at::text, v_next_review_at::text,
    v_reason, jsonb_build_object(
      'review_interval_days', p_review_interval_days,
      'decision_recorded_at', v_reviewed_at,
      'decision', 'continued_retention_review_scheduled'
    )
  );

  return query select p_candidate_id, v_next_review_at, v_reviewed_at;
end;
$function$;

revoke all on function public.review_workforce_candidate_retention(uuid, text, integer) from public, anon;
grant execute on function public.review_workforce_candidate_retention(uuid, text, integer) to authenticated;
