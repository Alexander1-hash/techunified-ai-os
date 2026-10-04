-- Phase 3: Objective & Orchestration foundation
-- Creates a durable business-objective layer without bypassing the governed
-- agent, approval, action-run, outcome, and learning systems from Phases 1-2.

CREATE TABLE IF NOT EXISTS public.business_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  owner_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  objective_type text NOT NULL DEFAULT 'business',
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'active',
  metric_name text,
  baseline_value numeric,
  current_value numeric,
  target_value numeric,
  unit text,
  currency text DEFAULT 'NGN',
  target_date date,
  progress_percent numeric NOT NULL DEFAULT 0,
  evidence_status text NOT NULL DEFAULT 'unverified',
  success_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_objectives_priority_check
    CHECK (priority IN ('low','medium','high','critical')),
  CONSTRAINT business_objectives_status_check
    CHECK (status IN ('draft','active','paused','achieved','cancelled')),
  CONSTRAINT business_objectives_evidence_check
    CHECK (evidence_status IN ('unverified','estimated','measured','attributed')),
  CONSTRAINT business_objectives_progress_check
    CHECK (progress_percent >= 0 AND progress_percent <= 100)
);

CREATE INDEX IF NOT EXISTS business_objectives_org_status_idx
  ON public.business_objectives (organization_id, status, priority);

CREATE INDEX IF NOT EXISTS business_objectives_org_target_idx
  ON public.business_objectives (organization_id, target_date);

CREATE TABLE IF NOT EXISTS public.business_objective_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  objective_id uuid NOT NULL REFERENCES public.business_objectives(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents(id) ON DELETE CASCADE,
  workflow_id uuid REFERENCES public.workflows(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'support',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_objective_links_target_check
    CHECK (num_nonnulls(agent_id, workflow_id) = 1),
  CONSTRAINT business_objective_links_role_check
    CHECK (role IN ('owner','support','execution')),
  UNIQUE (organization_id, objective_id, agent_id, workflow_id)
);

CREATE INDEX IF NOT EXISTS business_objective_links_objective_idx
  ON public.business_objective_links (organization_id, objective_id);

CREATE TABLE IF NOT EXISTS public.business_objective_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  objective_id uuid NOT NULL REFERENCES public.business_objectives(id) ON DELETE CASCADE,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  progress_percent numeric NOT NULL,
  metric_value numeric,
  evidence_status text NOT NULL DEFAULT 'unverified',
  source_type text NOT NULL DEFAULT 'manual',
  source_id uuid,
  note text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_objective_progress_percent_check
    CHECK (progress_percent >= 0 AND progress_percent <= 100),
  CONSTRAINT business_objective_progress_evidence_check
    CHECK (evidence_status IN ('unverified','estimated','measured','attributed'))
);

CREATE INDEX IF NOT EXISTS business_objective_progress_objective_idx
  ON public.business_objective_progress (organization_id, objective_id, recorded_at DESC);

CREATE OR REPLACE FUNCTION public.update_business_objectives_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_objectives_updated_at ON public.business_objectives;
CREATE TRIGGER business_objectives_updated_at
  BEFORE UPDATE ON public.business_objectives
  FOR EACH ROW
  EXECUTE FUNCTION public.update_business_objectives_updated_at();

ALTER TABLE public.business_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_objective_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_objective_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_objectives_org_select ON public.business_objectives;
CREATE POLICY business_objectives_org_select
  ON public.business_objectives FOR SELECT
  USING (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS business_objectives_org_insert ON public.business_objectives;
CREATE POLICY business_objectives_org_insert
  ON public.business_objectives FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS business_objectives_org_update ON public.business_objectives;
CREATE POLICY business_objectives_org_update
  ON public.business_objectives FOR UPDATE
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS business_objectives_org_delete ON public.business_objectives;
CREATE POLICY business_objectives_org_delete
  ON public.business_objectives FOR DELETE
  USING (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS business_objective_links_org_select ON public.business_objective_links;
CREATE POLICY business_objective_links_org_select
  ON public.business_objective_links FOR SELECT
  USING (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS business_objective_links_org_insert ON public.business_objective_links;
CREATE POLICY business_objective_links_org_insert
  ON public.business_objective_links FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS business_objective_links_org_update ON public.business_objective_links;
CREATE POLICY business_objective_links_org_update
  ON public.business_objective_links FOR UPDATE
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS business_objective_links_org_delete ON public.business_objective_links;
CREATE POLICY business_objective_links_org_delete
  ON public.business_objective_links FOR DELETE
  USING (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS business_objective_progress_org_select ON public.business_objective_progress;
CREATE POLICY business_objective_progress_org_select
  ON public.business_objective_progress FOR SELECT
  USING (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS business_objective_progress_org_insert ON public.business_objective_progress;
CREATE POLICY business_objective_progress_org_insert
  ON public.business_objective_progress FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS business_objective_progress_org_update ON public.business_objective_progress;
CREATE POLICY business_objective_progress_org_update
  ON public.business_objective_progress FOR UPDATE
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS business_objective_progress_org_delete ON public.business_objective_progress;
CREATE POLICY business_objective_progress_org_delete
  ON public.business_objective_progress FOR DELETE
  USING (organization_id = public.get_user_organization_id());
