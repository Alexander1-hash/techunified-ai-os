create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  full_name text,
  avatar_url text,
  role text not null default 'Viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid,
  name text not null,
  purpose text not null default '',
  status text not null default 'Draft',
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agents add constraint agents_department_id_fkey foreign key (department_id) references public.departments(id) on delete set null;

create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text not null default '',
  status text not null default 'Draft',
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  source text,
  status text not null default 'Pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  metric_name text not null,
  metric_value numeric not null default 0,
  recorded_at timestamptz not null default now()
);

create index if not exists profiles_organization_id_idx on public.profiles(organization_id);
create index if not exists agents_organization_id_idx on public.agents(organization_id);
create index if not exists departments_organization_id_idx on public.departments(organization_id);
create index if not exists workflows_organization_id_idx on public.workflows(organization_id);
create index if not exists knowledge_documents_organization_id_idx on public.knowledge_documents(organization_id);
create index if not exists activity_logs_organization_id_idx on public.activity_logs(organization_id);
create index if not exists analytics_metrics_organization_id_idx on public.analytics_metrics(organization_id);

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$ begin new.updated_at = now(); return new; end; $$;

do $$ declare table_name text; begin foreach table_name in array array['organizations','profiles','agents','departments','workflows','knowledge_documents'] loop execute format('drop trigger if exists %I on public.%I', table_name || '_set_updated_at', table_name); execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', table_name || '_set_updated_at', table_name); end loop; end $$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.agents enable row level security;
alter table public.departments enable row level security;
alter table public.workflows enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.activity_logs enable row level security;
alter table public.analytics_metrics enable row level security;

do $$ declare table_name text; begin foreach table_name in array array['profiles','agents','departments','workflows','knowledge_documents','activity_logs','analytics_metrics'] loop execute format('drop policy if exists %I on public.%I', table_name || '_org_select', table_name); execute format('create policy %I on public.%I for select to authenticated using (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())))', table_name || '_org_select', table_name); end loop; end $$;

create policy organizations_select_own on public.organizations for select to authenticated using (id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));
create policy organizations_update_own on public.organizations for update to authenticated using (id = (select p.organization_id from public.profiles p where p.id = (select auth.uid()))) with check (id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));
create policy profiles_update_own on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy agents_insert_org on public.agents for insert to authenticated with check (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));
create policy agents_update_org on public.agents for update to authenticated using (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid()))) with check (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));
create policy agents_delete_org on public.agents for delete to authenticated using (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));
create policy departments_insert_org on public.departments for insert to authenticated with check (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));
create policy workflows_insert_org on public.workflows for insert to authenticated with check (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));
create policy knowledge_documents_insert_org on public.knowledge_documents for insert to authenticated with check (organization_id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));

revoke all on public.organizations, public.profiles, public.agents, public.departments, public.workflows, public.knowledge_documents, public.activity_logs, public.analytics_metrics from anon;
grant select on public.organizations, public.profiles, public.agents, public.departments, public.workflows, public.knowledge_documents, public.activity_logs, public.analytics_metrics to authenticated;
grant insert, update, delete on public.agents, public.departments, public.workflows, public.knowledge_documents to authenticated;
grant update on public.organizations, public.profiles to authenticated;
