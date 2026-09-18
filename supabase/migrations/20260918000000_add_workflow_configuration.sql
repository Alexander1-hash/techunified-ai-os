alter table if exists public.workflows
  add column if not exists configuration jsonb
  not null default '{
    "trigger": {
      "type": "manual",
      "config": {}
    },
    "conditions": [],
    "steps": []
  }'::jsonb;

notify pgrst, 'reload schema';
