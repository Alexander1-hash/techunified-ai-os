-- ============================================================
-- TECHUNIFIED AI OS
-- PHASE 4 — END-TO-END PIPELINE VALIDATION
-- ============================================================

CREATE TABLE IF NOT EXISTS public.business_pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'failed',
  dataset_name text,
  stages jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_pipeline_runs_status_check
    CHECK (status IN ('passed','partial','failed'))
);

CREATE INDEX IF NOT EXISTS business_pipeline_runs_org_time_idx
ON public.business_pipeline_runs (organization_id, created_at DESC);

ALTER TABLE public.business_pipeline_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_pipeline_runs_org_select
ON public.business_pipeline_runs;

CREATE POLICY business_pipeline_runs_org_select
ON public.business_pipeline_runs
FOR SELECT TO authenticated
USING (
  organization_id = (
    SELECT p.organization_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

DROP POLICY IF EXISTS business_pipeline_runs_org_insert
ON public.business_pipeline_runs;

CREATE POLICY business_pipeline_runs_org_insert
ON public.business_pipeline_runs
FOR INSERT TO authenticated
WITH CHECK (
  organization_id = (
    SELECT p.organization_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

SELECT 'Phase 4 end-to-end pipeline validation layer applied' AS status;
