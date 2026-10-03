-- Phase 2 governed agent approvals
CREATE TABLE IF NOT EXISTS public.agent_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  agent_run_id uuid NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  action_type text NOT NULL DEFAULT 'proposal',
  title text NOT NULL,
  reason text,
  proposed_action jsonb NOT NULL DEFAULT '{}'::jsonb,
  decision_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewer_note text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_approvals_status_check CHECK (status IN ('pending','approved','rejected','cancelled')),
  CONSTRAINT agent_approvals_action_type_check CHECK (action_type IN ('proposal','workflow_execution'))
);

CREATE INDEX IF NOT EXISTS agent_approvals_org_status_idx ON public.agent_approvals (organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_approvals_run_idx ON public.agent_approvals (agent_run_id);

ALTER TABLE public.agent_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_approvals_org_select ON public.agent_approvals;
CREATE POLICY agent_approvals_org_select ON public.agent_approvals FOR SELECT TO authenticated
USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS agent_approvals_org_insert ON public.agent_approvals;
CREATE POLICY agent_approvals_org_insert ON public.agent_approvals FOR INSERT TO authenticated
WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS agent_approvals_org_update ON public.agent_approvals;
CREATE POLICY agent_approvals_org_update ON public.agent_approvals FOR UPDATE TO authenticated
USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()))
WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP TRIGGER IF EXISTS agent_approvals_set_updated_at ON public.agent_approvals;
CREATE TRIGGER agent_approvals_set_updated_at BEFORE UPDATE ON public.agent_approvals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
