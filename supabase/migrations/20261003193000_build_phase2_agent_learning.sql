-- Phase 2 AI Workforce: durable learning provenance and agent evaluations
ALTER TABLE public.agent_memory
  ADD COLUMN IF NOT EXISTS confidence integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS evidence_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'run',
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz;

ALTER TABLE public.agent_memory
  DROP CONSTRAINT IF EXISTS agent_memory_confidence_check;
ALTER TABLE public.agent_memory
  ADD CONSTRAINT agent_memory_confidence_check CHECK (confidence BETWEEN 0 AND 100);

ALTER TABLE public.agent_memory
  DROP CONSTRAINT IF EXISTS agent_memory_evidence_status_check;
ALTER TABLE public.agent_memory
  ADD CONSTRAINT agent_memory_evidence_status_check CHECK (evidence_status IN ('verified','attributed','explicit','unverified'));

ALTER TABLE public.agent_memory
  DROP CONSTRAINT IF EXISTS agent_memory_source_type_check;
ALTER TABLE public.agent_memory
  ADD CONSTRAINT agent_memory_source_type_check CHECK (source_type IN ('run','outcome','action_run','human','system'));

CREATE INDEX IF NOT EXISTS agent_memory_relevance_idx
  ON public.agent_memory (organization_id, agent_id, evidence_status, confidence DESC, importance DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS public.agent_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  evaluator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  groundedness_score integer,
  tool_accuracy_score integer,
  execution_success boolean,
  outcome_linked boolean NOT NULL DEFAULT false,
  human_feedback text,
  reviewer_note text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_evaluations_groundedness_check CHECK (groundedness_score IS NULL OR groundedness_score BETWEEN 0 AND 100),
  CONSTRAINT agent_evaluations_tool_accuracy_check CHECK (tool_accuracy_score IS NULL OR tool_accuracy_score BETWEEN 0 AND 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_evaluations_run_unique_idx ON public.agent_evaluations (run_id);
CREATE INDEX IF NOT EXISTS agent_evaluations_org_agent_idx ON public.agent_evaluations (organization_id, agent_id, created_at DESC);

ALTER TABLE public.agent_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_evaluations_org_select ON public.agent_evaluations;
CREATE POLICY agent_evaluations_org_select ON public.agent_evaluations FOR SELECT TO authenticated
USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS agent_evaluations_org_insert ON public.agent_evaluations;
CREATE POLICY agent_evaluations_org_insert ON public.agent_evaluations FOR INSERT TO authenticated
WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS agent_evaluations_org_update ON public.agent_evaluations;
CREATE POLICY agent_evaluations_org_update ON public.agent_evaluations FOR UPDATE TO authenticated
USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()))
WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP TRIGGER IF EXISTS agent_evaluations_set_updated_at ON public.agent_evaluations;
CREATE TRIGGER agent_evaluations_set_updated_at BEFORE UPDATE ON public.agent_evaluations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
