-- Workspace identity preference: personal profile or company logo.
alter table public.profiles
  add column if not exists identity_preference text not null default 'personal';

alter table public.profiles
  drop constraint if exists profiles_identity_preference_check;

alter table public.profiles
  add constraint profiles_identity_preference_check
  check (identity_preference in ('personal', 'company'));
