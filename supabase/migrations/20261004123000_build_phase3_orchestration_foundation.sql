-- Phase 3: governed objective orchestration
-- Reuses the existing company_objectives, agent_runs, business_action_runs,
-- approvals, workflows, outcomes and learning systems. No parallel objective model.

CREATE TABLE IF NOT EXISTS public.business_orchestration_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  objective_id uuid NOT NULL REFERENCES public.company_objectives(id) ON DELETE CASCADE,
  initiated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  lead_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planning',
  approval_status text NOT NULL DEFAULT 'not_required',
  plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  context_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  agent_run_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  action_run_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_orchestration_runs_status_check
    CHECK (status IN ('planning','awaiting_approval','executing','completed','failed','cancelled')),
  CONSTRAINT business_orchestration_runs_approval_check
    CHECK (approval_status IN ('not_required','pending','approved','rejected'))
);

CREATE INDEX IF NOT EXISTS business_orchestration_runs_org_objective_idx
  ON public.business_orchestration_runs (organization_id, objective_id, created_at DESC);

CREATE INDEX IF NOT EXISTS business_orchestration_runs_org_status_idx
  ON public.business_orchestration_runs (organization_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_business_orchestration_runs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_orchestration_runs_updated_at ON public.business_orchestration_runs;
CREATE TRIGGER business_orchestration_runs_updated_at
  BEFORE UPDATE ON public.business_orchestration_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_business_orchestration_runs_updated_at();

ALTER TABLE public.business_orchestration_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_orchestration_runs_org_select ON public.business_orchestration_runs;
CREATE POLICY business_orchestration_runs_org_select
  ON public.business_orchestration_runs FOR SELECT
  USING (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS business_orchestration_runs_org_insert ON public.business_orchestration_runs;
CREATE POLICY business_orchestration_runs_org_insert
  ON public.business_orchestration_runs FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS business_orchestration_runs_org_update ON public.business_orchestration_runs;
CREATE POLICY business_orchestration_runs_org_update
  ON public.business_orchestration_runs FOR UPDATE
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS business_orchestration_runs_org_delete ON public.business_orchestration_runs;
CREATE POLICY business_orchestration_runs_org_delete
  ON public.business_orchestration_runs FOR DELETE
  USING (organization_id = public.get_user_organization_id());
