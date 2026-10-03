-- Phase 1 closed-loop orchestration: decision -> workflow -> automation -> measured outcome
CREATE TABLE IF NOT EXISTS public.business_action_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  decision_id text,
  decision_type text,
  decision_title text,
  workflow_id uuid REFERENCES public.workflows(id) ON DELETE SET NULL,
  execution_id uuid REFERENCES public.automation_executions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_action_runs_status_check
    CHECK (status IN ('pending','running','completed','failed','cancelled'))
);

CREATE INDEX IF NOT EXISTS business_action_runs_org_idx
  ON public.business_action_runs (organization_id);
CREATE INDEX IF NOT EXISTS business_action_runs_workflow_idx
  ON public.business_action_runs (workflow_id);
CREATE INDEX IF NOT EXISTS business_action_runs_execution_idx
  ON public.business_action_runs (execution_id);
CREATE INDEX IF NOT EXISTS business_action_runs_created_idx
  ON public.business_action_runs (created_at DESC);

ALTER TABLE public.business_action_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_action_runs_org_select ON public.business_action_runs;
CREATE POLICY business_action_runs_org_select
  ON public.business_action_runs FOR SELECT TO authenticated
  USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS business_action_runs_org_insert ON public.business_action_runs;
CREATE POLICY business_action_runs_org_insert
  ON public.business_action_runs FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS business_action_runs_org_update ON public.business_action_runs;
CREATE POLICY business_action_runs_org_update
  ON public.business_action_runs FOR UPDATE TO authenticated
  USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()))
  WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS business_action_runs_org_delete ON public.business_action_runs;
CREATE POLICY business_action_runs_org_delete
  ON public.business_action_runs FOR DELETE TO authenticated
  USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP TRIGGER IF EXISTS business_action_runs_set_updated_at ON public.business_action_runs;
CREATE TRIGGER business_action_runs_set_updated_at
  BEFORE UPDATE ON public.business_action_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.business_outcomes
  ADD COLUMN IF NOT EXISTS action_run_id uuid REFERENCES public.business_action_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS business_outcomes_action_run_idx
  ON public.business_outcomes (action_run_id);
