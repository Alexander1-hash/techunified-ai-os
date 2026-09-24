-- Organization logo upload support
-- Creates a safe, organization-scoped public storage bucket for workspace logos.

alter table public.organizations
  add column if not exists logo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-logos',
  'organization-logos',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "organization logos public read" on storage.objects;
create policy "organization logos public read"
on storage.objects
for select
to public
using (bucket_id = 'organization-logos');

drop policy if exists "organization logos members upload" on storage.objects;
create policy "organization logos members upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'organization-logos'
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.organization_id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists "organization logos members update" on storage.objects;
create policy "organization logos members update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'organization-logos'
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.organization_id::text = (storage.foldername(name))[1]
  )
)
with check (
  bucket_id = 'organization-logos'
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.organization_id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists "organization logos members delete" on storage.objects;
create policy "organization logos members delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'organization-logos'
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.organization_id::text = (storage.foldername(name))[1]
  )
);
