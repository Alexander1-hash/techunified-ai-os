create table if not exists public.workspace_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  source text not null check (source in ('guidance','developer','system','ai','activity')),
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  title text not null,
  body text not null,
  action_label text,
  action_href text,
  status text not null default 'unread' check (status in ('unread','read','dismissed')),
  metadata jsonb not null default '{}'::jsonb,
  dedupe_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  read_at timestamptz,
  dismissed_at timestamptz,
  expires_at timestamptz,
  constraint workspace_messages_target_check
    check (organization_id is not null or source = 'developer')
);

create index if not exists workspace_messages_org_created_idx
  on public.workspace_messages (organization_id, created_at desc);

create index if not exists workspace_messages_user_created_idx
  on public.workspace_messages (user_id, created_at desc);

create index if not exists workspace_messages_source_created_idx
  on public.workspace_messages (source, created_at desc);

create unique index if not exists workspace_messages_dedupe_idx
  on public.workspace_messages (
    coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    source,
    dedupe_key
  )
  where dedupe_key is not null;

create or replace function public.set_workspace_message_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_workspace_message_updated_at() from public;

drop trigger if exists workspace_messages_updated_at on public.workspace_messages;
create trigger workspace_messages_updated_at
before update on public.workspace_messages
for each row execute function public.set_workspace_message_updated_at();

create or replace function public.ensure_workspace_guidance_for_current_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select organization_id
  into v_organization_id
  from public.profiles
  where id = v_user_id;

  if v_organization_id is null then
    return;
  end if;

  insert into public.workspace_messages (
    organization_id,
    source,
    priority,
    title,
    body,
    action_label,
    action_href,
    dedupe_key,
    metadata
  )
  values (
    v_organization_id,
    'guidance',
    'high',
    'Your first step: connect company knowledge',
    'TechUnified AI OS works best when Company Brain has real information about your business. Start by connecting or importing your first business knowledge source, then review what the system understands before moving into analysis and automation.',
    'Open Company Brain',
    '/company-brain',
    'first-company-knowledge-v1',
    jsonb_build_object(
      'sequence', 1,
      'next_steps', jsonb_build_array(
        'Connect your first business knowledge source',
        'Review Company Brain',
        'Run your first Business Analysis',
        'Create or activate an AI agent',
        'Review recommended actions'
      )
    )
  )
  on conflict do nothing;
end;
$$;

revoke all on function public.ensure_workspace_guidance_for_current_user() from public;
grant execute on function public.ensure_workspace_guidance_for_current_user() to authenticated;

alter table public.workspace_messages enable row level security;

drop policy if exists workspace_messages_select on public.workspace_messages;
create policy workspace_messages_select
on public.workspace_messages
for select
to authenticated
using (
  (
    organization_id is null
    and source = 'developer'
  )
  or
  (
    organization_id is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = workspace_messages.organization_id
    )
    and (user_id is null or user_id = auth.uid())
  )
);

drop policy if exists workspace_messages_insert on public.workspace_messages;
create policy workspace_messages_insert
on public.workspace_messages
for insert
to authenticated
with check (
  source = 'activity'
  and organization_id is not null
  and user_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = workspace_messages.organization_id
  )
);

drop policy if exists workspace_messages_update on public.workspace_messages;
create policy workspace_messages_update
on public.workspace_messages
for update
to authenticated
using (
  organization_id is not null
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = workspace_messages.organization_id
  )
  and (user_id is null or user_id = auth.uid())
)
with check (
  organization_id is not null
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = workspace_messages.organization_id
  )
  and (user_id is null or user_id = auth.uid())
);

drop policy if exists workspace_messages_delete on public.workspace_messages;
create policy workspace_messages_delete
on public.workspace_messages
for delete
to authenticated
using (
  organization_id is not null
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = workspace_messages.organization_id
  )
  and (user_id is null or user_id = auth.uid())
);

insert into public.workspace_messages (
  source,
  priority,
  title,
  body,
  action_label,
  action_href,
  dedupe_key
)
values (
  'developer',
  'normal',
  'Welcome to TechUnified AI OS',
  'Your company now has an intelligent operating layer. Start by completing your workspace setup, then connect your first business knowledge source so Company Brain can begin working with real company information.',
  'Open Company Brain',
  '/company-brain',
  'global-welcome-v1'
)
on conflict do nothing;
