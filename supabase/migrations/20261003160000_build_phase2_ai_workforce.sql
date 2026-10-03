-- Phase 2 AI Workforce: governed agent runs, memory, tool permissions and evaluation
CREATE TABLE IF NOT EXISTS public.agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  task text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  autonomy_mode text NOT NULL DEFAULT 'assist',
  requires_approval boolean NOT NULL DEFAULT true,
  approval_status text NOT NULL DEFAULT 'not_required',
  tool_calls jsonb NOT NULL DEFAULT '[]'::jsonb,
  context_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_runs_status_check CHECK (status IN ('pending','running','completed','failed','cancelled')),
  CONSTRAINT agent_runs_autonomy_check CHECK (autonomy_mode IN ('assist','supervised','bounded')),
  CONSTRAINT agent_runs_approval_check CHECK (approval_status IN ('not_required','pending','approved','rejected'))
);

CREATE INDEX IF NOT EXISTS agent_runs_org_idx ON public.agent_runs (organization_id);
CREATE INDEX IF NOT EXISTS agent_runs_agent_idx ON public.agent_runs (agent_id);
CREATE INDEX IF NOT EXISTS agent_runs_created_idx ON public.agent_runs (created_at DESC);

ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_runs_org_select ON public.agent_runs;
CREATE POLICY agent_runs_org_select ON public.agent_runs FOR SELECT TO authenticated
USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS agent_runs_org_insert ON public.agent_runs;
CREATE POLICY agent_runs_org_insert ON public.agent_runs FOR INSERT TO authenticated
WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS agent_runs_org_update ON public.agent_runs;
CREATE POLICY agent_runs_org_update ON public.agent_runs FOR UPDATE TO authenticated
USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()))
WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.agent_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  memory_type text NOT NULL DEFAULT 'working',
  content text NOT NULL,
  importance integer NOT NULL DEFAULT 50,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_memory_type_check CHECK (memory_type IN ('working','fact','lesson','preference','constraint')),
  CONSTRAINT agent_memory_importance_check CHECK (importance BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS agent_memory_org_agent_idx ON public.agent_memory (organization_id, agent_id);
CREATE INDEX IF NOT EXISTS agent_memory_created_idx ON public.agent_memory (created_at DESC);

ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_memory_org_select ON public.agent_memory;
CREATE POLICY agent_memory_org_select ON public.agent_memory FOR SELECT TO authenticated
USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS agent_memory_org_insert ON public.agent_memory;
CREATE POLICY agent_memory_org_insert ON public.agent_memory FOR INSERT TO authenticated
WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS agent_memory_org_update ON public.agent_memory;
CREATE POLICY agent_memory_org_update ON public.agent_memory FOR UPDATE TO authenticated
USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()))
WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP TRIGGER IF EXISTS agent_runs_set_updated_at ON public.agent_runs;
CREATE TRIGGER agent_runs_set_updated_at BEFORE UPDATE ON public.agent_runs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
