create extension if not exists pgcrypto;

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content text not null,
  chunk_index integer not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists knowledge_chunks_organization_idx
  on public.knowledge_chunks (organization_id);

create index if not exists knowledge_chunks_document_idx
  on public.knowledge_chunks (document_id, chunk_index);

create index if not exists knowledge_chunks_content_search_idx
  on public.knowledge_chunks
  using gin (to_tsvector('english', content));

alter table public.knowledge_chunks enable row level security;

drop policy if exists knowledge_chunks_select_org on public.knowledge_chunks;
create policy knowledge_chunks_select_org
  on public.knowledge_chunks
  for select
  using (
    organization_id = (
      select organization_id
      from public.profiles
      where id = auth.uid()
    )
  );

drop policy if exists knowledge_chunks_insert_org on public.knowledge_chunks;
create policy knowledge_chunks_insert_org
  on public.knowledge_chunks
  for insert
  with check (
    organization_id = (
      select organization_id
      from public.profiles
      where id = auth.uid()
    )
  );

drop policy if exists knowledge_chunks_update_org on public.knowledge_chunks;
create policy knowledge_chunks_update_org
  on public.knowledge_chunks
  for update
  using (
    organization_id = (
      select organization_id
      from public.profiles
      where id = auth.uid()
    )
  )
  with check (
    organization_id = (
      select organization_id
      from public.profiles
      where id = auth.uid()
    )
  );

drop policy if exists knowledge_chunks_delete_org on public.knowledge_chunks;
create policy knowledge_chunks_delete_org
  on public.knowledge_chunks
  for delete
  using (
    organization_id = (
      select organization_id
      from public.profiles
      where id = auth.uid()
    )
  );

create or replace function public.touch_knowledge_document_status()
returns trigger
language plpgsql
as $$
begin
  update public.knowledge_documents
  set updated_at = now()
  where id = new.document_id;
  return new;
end;
$$;

do $$
begin
  raise notice 'Company Brain knowledge chunks foundation applied';
end $$;
