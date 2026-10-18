-- Make trusted candidate ingestion and its audit events one database transaction.
-- Only the server-side service role may call this RPC; browser roles cannot ingest leads.
create or replace function public.ingest_workforce_candidate_leads(
  p_vacancy_id uuid,
  p_source_id text,
  p_authorization_reference text,
  p_candidates jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_vacancy record;
  v_item jsonb;
  v_candidate public.workforce_candidate_leads%rowtype;
  v_saved jsonb := '[]'::jsonb;
  v_source_id text := left(trim(coalesce(p_source_id, '')), 160);
  v_candidate_id text;
  v_retrieved_at timestamptz := now();
  v_retention_review_at timestamptz := now() + interval '90 days';
  v_count integer := 0;
begin
  if p_vacancy_id is null or v_source_id = '' then
    raise exception 'invalid_ingestion_request' using errcode = '22023';
  end if;

  if jsonb_typeof(p_candidates) is distinct from 'array' then
    raise exception 'candidate_batch_must_be_an_array' using errcode = '22023';
  end if;

  if jsonb_array_length(p_candidates) < 1 or jsonb_array_length(p_candidates) > 50 then
    raise exception 'candidate_batch_must_contain_1_to_50_items' using errcode = '22023';
  end if;

  select v.id, v.organization_id, v.status, v.processing_authorized, v.authorization_reference
    into v_vacancy
  from public.workforce_vacancies v
  where v.id = p_vacancy_id
  for update;

  if not found then
    raise exception 'vacancy_not_found' using errcode = 'P0002';
  end if;

  if v_vacancy.status <> 'open' or v_vacancy.processing_authorized is distinct from true then
    raise exception 'vacancy_must_be_open_and_authorized' using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_authorization_reference, '')), '') is null
     or p_authorization_reference <> v_vacancy.authorization_reference then
    raise exception 'authorization_reference_mismatch' using errcode = '42501';
  end if;

  for v_item in select value from jsonb_array_elements(p_candidates)
  loop
    v_candidate_id := left(trim(coalesce(v_item->>'source_candidate_id', '')), 240);
    if v_candidate_id = '' then
      continue;
    end if;

    insert into public.workforce_candidate_leads (
      organization_id, vacancy_id, source_id, source_candidate_id,
      display_name, profile_url, location_text, job_relevant_summary,
      job_relevant_skills, evidence_status, retrieved_at, retention_review_at
    ) values (
      v_vacancy.organization_id, v_vacancy.id, v_source_id, v_candidate_id,
      nullif(left(coalesce(v_item->>'display_name', ''), 200), ''),
      nullif(left(coalesce(v_item->>'profile_url', ''), 2048), ''),
      nullif(left(coalesce(v_item->>'location_text', ''), 240), ''),
      nullif(left(coalesce(v_item->>'job_relevant_summary', ''), 1200), ''),
      case when jsonb_typeof(v_item->'job_relevant_skills') = 'array'
        then (select coalesce(jsonb_agg(to_jsonb(left(trim(value), 100))), '[]'::jsonb)
              from (select value from jsonb_array_elements_text(v_item->'job_relevant_skills') limit 40) s
              where trim(value) <> '')
        else '[]'::jsonb end,
      'unverified', v_retrieved_at, v_retention_review_at
    )
    on conflict (organization_id, vacancy_id, source_id, source_candidate_id)
    do update set
      display_name = excluded.display_name,
      profile_url = excluded.profile_url,
      location_text = excluded.location_text,
      job_relevant_summary = excluded.job_relevant_summary,
      job_relevant_skills = excluded.job_relevant_skills,
      retrieved_at = excluded.retrieved_at,
      retention_review_at = excluded.retention_review_at
    returning * into v_candidate;

    insert into public.workforce_recruitment_events (
      organization_id, vacancy_id, candidate_lead_id, actor_id,
      event_type, from_status, to_status, reason, metadata
    ) values (
      v_candidate.organization_id, v_candidate.vacancy_id, v_candidate.id, null,
      'candidate_lead_ingested', null, v_candidate.review_status, null,
      jsonb_build_object('source_id', v_source_id, 'ingestion_surface', 'trusted_provider_api')
    );

    v_saved := v_saved || jsonb_build_array(jsonb_build_object(
      'id', v_candidate.id,
      'vacancy_id', v_candidate.vacancy_id,
      'source_id', v_candidate.source_id,
      'source_candidate_id', v_candidate.source_candidate_id,
      'display_name', v_candidate.display_name,
      'profile_url', v_candidate.profile_url,
      'location_text', v_candidate.location_text,
      'job_relevant_summary', v_candidate.job_relevant_summary,
      'job_relevant_skills', v_candidate.job_relevant_skills,
      'evidence_status', v_candidate.evidence_status,
      'review_status', v_candidate.review_status,
      'retrieved_at', v_candidate.retrieved_at,
      'retention_review_at', v_candidate.retention_review_at
    ));
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'no_valid_candidate_identifiers' using errcode = '22023';
  end if;

  return jsonb_build_object('count', v_count, 'candidates', v_saved, 'audit', 'recorded_atomically');
end;
$function$;

revoke all on function public.ingest_workforce_candidate_leads(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.ingest_workforce_candidate_leads(uuid, text, text, jsonb) to service_role;
