-- Tighten workforce lead ingestion and review permissions.
-- Candidate provenance is server-owned; authenticated users may only change review_status.
revoke insert, delete on table public.workforce_candidate_leads from anon, authenticated;
revoke update on table public.workforce_candidate_leads from anon, authenticated;
grant update (review_status) on table public.workforce_candidate_leads to authenticated;

revoke insert, update, delete on table public.workforce_recruitment_events from anon, authenticated;
revoke all on table public.workforce_candidate_leads from anon;
revoke all on table public.workforce_recruitment_events from anon;

-- The API performs explicit organization and vacancy checks before any review update.
-- Provider ingestion must use trusted server-side credentials and must never accept
-- an arbitrary organization_id or verified-evidence claim from the browser.
