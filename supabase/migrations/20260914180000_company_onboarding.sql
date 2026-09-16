alter table public.organizations
  add column if not exists description text,
  add column if not exists industry text,
  add column if not exists website text,
  add column if not exists timezone text not null default 'Africa/Lagos';

create or replace function public.create_organization_for_current_user(
  p_name text,
  p_description text default null,
  p_industry text,
  p_website text default null,
  p_timezone text default 'Africa/Lagos'
)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles;
  v_organization public.organizations;
begin
  if v_user_id is null then
    raise exception 'not_authenticated'
      using errcode = '42501';
  end if;

  if p_name is null
     or char_length(btrim(p_name)) = 0
     or char_length(btrim(p_name)) > 120 then
    raise exception 'invalid_company_name'
      using errcode = '22023';
  end if;

  if p_description is not null
     and char_length(btrim(p_description)) > 500 then
    raise exception 'invalid_description'
      using errcode = '22023';
  end if;

  if p_industry is null
     or char_length(btrim(p_industry)) = 0
     or char_length(btrim(p_industry)) > 120 then
    raise exception 'invalid_industry'
      using errcode = '22023';
  end if;

  if p_website is not null
     and (
       char_length(btrim(p_website)) > 300
       or btrim(p_website) !~* '^https?://[^[:space:]]+$'
     ) then
    raise exception 'invalid_website'
      using errcode = '22023';
  end if;

  if p_timezone is not null
     and (
       char_length(btrim(p_timezone)) = 0
       or char_length(btrim(p_timezone)) > 100
       or (
         btrim(p_timezone) <> 'UTC'
         and btrim(p_timezone) !~ '^[A-Za-z]+/[A-Za-z_]+$'
       )
     ) then
    raise exception 'invalid_timezone'
      using errcode = '22023';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception 'profile_not_found'
      using errcode = 'P0002';
  end if;

  if v_profile.organization_id is not null then
    select *
    into v_organization
    from public.organizations
    where id = v_profile.organization_id;

    return v_organization;
  end if;

  insert into public.organizations (
    name,
    description,
    industry,
    website,
    timezone
  )
  values (
    trim(p_name),
    nullif(trim(coalesce(p_description, '')), ''),
    trim(p_industry),
    nullif(trim(coalesce(p_website, '')), ''),
    coalesce(
      nullif(trim(p_timezone), ''),
      'Africa/Lagos'
    )
  )
  returning *
  into v_organization;

  update public.profiles
  set
    organization_id = v_organization.id,
    role = case
      when lower(role::text) = 'viewer'
        then 'owner'::user_role
      else role
    end,
    updated_at = now()
  where id = v_user_id
    and organization_id is null;

  if not found then
    select *
    into v_organization
    from public.organizations
    where id = (
      select organization_id
      from public.profiles
      where id = v_user_id
    );
  end if;

  return v_organization;
end;
$$;

revoke all
on function public.create_organization_for_current_user(
  text,
  text,
  text,
  text,
  text
)
from public;

grant execute
on function public.create_organization_for_current_user(
  text,
  text,
  text,
  text,
  text
)
to authenticated;
