-- Human-governed vacancy lifecycle with organization authorization and atomic audit events.
create or replace function public.transition_workforce_vacancy_status(
  p_vacancy_id uuid,
  p_next_status text,
  p_reason text default null
)
returns table(vacancy_id uuid, status text, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_organization_id uuid;
  v_actor_role text;
  v_old_status text;
  v_authorized boolean;
  v_authorization_reference text;
  v_updated_at timestamptz;
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 1000), '');
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_next_status not in ('draft', 'open', 'paused', 'filled', 'cancelled') then
    raise exception 'invalid_vacancy_status' using errcode = '22023';
  end if;

  select p.organization_id, p.role into v_organization_id, v_actor_role
  from public.profiles p where p.id = v_actor;

  if v_organization_id is null or coalesce(v_actor_role, '') not in ('owner', 'admin', 'organization_admin', 'recruiter', 'hiring_manager') then
    raise exception 'recruitment_role_required' using errcode = '42501';
  end if;

  select v.status, v.processing_authorized, v.authorization_reference
    into v_old_status, v_authorized, v_authorization_reference
  from public.workforce_vacancies v
  where v.id = p_vacancy_id and v.organization_id = v_organization_id
  for update;

  if not found then
    raise exception 'vacancy_not_found' using errcode = 'P0002';
  end if;

  if v_old_status = p_next_status then
    raise exception 'vacancy_already_in_requested_status' using errcode = '22023';
  end if;

  if v_old_status in ('filled', 'cancelled') then
    raise exception 'terminal_vacancy_status' using errcode = '22023';
  end if;

  if p_next_status = 'open' and (v_authorized is distinct from true or nullif(trim(coalesce(v_authorization_reference, '')), '') is null) then
    raise exception 'documented_processing_authorization_required' using errcode = '42501';
  end if;

  if p_next_status in ('filled', 'cancelled', 'paused', 'draft') and v_reason is null then
    raise exception 'status_change_reason_required' using errcode = '22023';
  end if;

  update public.workforce_vacancies v
    set status = p_next_status
  where v.id = p_vacancy_id and v.organization_id = v_organization_id
  returning v.updated_at into v_updated_at;

  insert into public.workforce_recruitment_events (
    organization_id, vacancy_id, candidate_lead_id, actor_id,
    event_type, from_status, to_status, reason, metadata
  ) values (
    v_organization_id, p_vacancy_id, null, v_actor,
    'vacancy_status_changed', v_old_status, p_next_status, v_reason,
    jsonb_build_object('transition_surface', 'workforce_workspace')
  );

  return query select p_vacancy_id, p_next_status, v_updated_at;
end;
$function$;

revoke all on function public.transition_workforce_vacancy_status(uuid, text, text) from public, anon;
grant execute on function public.transition_workforce_vacancy_status(uuid, text, text) to authenticated;
