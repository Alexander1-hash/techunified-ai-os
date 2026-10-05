-- Phase 4 completion: longitudinal intelligence and company graph
CREATE TABLE IF NOT EXISTS public.company_intelligence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  snapshot_id uuid REFERENCES public.company_intelligence_snapshots(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  description text NOT NULL,
  before_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_intelligence_events_type_check CHECK (event_type IN ('state_change','signal_change','forecast_change','objective_change','learning_change','governance_change')),
  CONSTRAINT company_intelligence_events_severity_check CHECK (severity IN ('info','low','medium','high','critical'))
);

CREATE INDEX IF NOT EXISTS company_intelligence_events_org_time_idx
  ON public.company_intelligence_events (organization_id, detected_at DESC);

CREATE TABLE IF NOT EXISTS public.company_intelligence_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  from_type text NOT NULL,
  from_id text NOT NULL,
  to_type text NOT NULL,
  to_id text NOT NULL,
  relation text NOT NULL,
  confidence text NOT NULL DEFAULT 'medium',
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_intelligence_edges_confidence_check CHECK (confidence IN ('low','medium','high')),
  CONSTRAINT company_intelligence_edges_relation_check CHECK (relation IN ('supports','depends_on','blocks','causes','measures','acts_on','produces','learns_from','governs','predicts')),
  CONSTRAINT company_intelligence_edges_unique UNIQUE (organization_id, from_type, from_id, to_type, to_id, relation)
);

CREATE INDEX IF NOT EXISTS company_intelligence_edges_org_from_idx
  ON public.company_intelligence_edges (organization_id, from_type, from_id);

CREATE INDEX IF NOT EXISTS company_intelligence_edges_org_to_idx
  ON public.company_intelligence_edges (organization_id, to_type, to_id);

ALTER TABLE public.company_intelligence_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_intelligence_edges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_intelligence_events_org_select ON public.company_intelligence_events;
CREATE POLICY company_intelligence_events_org_select ON public.company_intelligence_events
FOR SELECT TO authenticated
USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS company_intelligence_events_org_insert ON public.company_intelligence_events;
CREATE POLICY company_intelligence_events_org_insert ON public.company_intelligence_events
FOR INSERT TO authenticated
WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS company_intelligence_edges_org_select ON public.company_intelligence_edges;
CREATE POLICY company_intelligence_edges_org_select ON public.company_intelligence_edges
FOR SELECT TO authenticated
USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS company_intelligence_edges_org_insert ON public.company_intelligence_edges;
CREATE POLICY company_intelligence_edges_org_insert ON public.company_intelligence_edges
FOR INSERT TO authenticated
WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS company_intelligence_edges_org_update ON public.company_intelligence_edges;
CREATE POLICY company_intelligence_edges_org_update ON public.company_intelligence_edges
FOR UPDATE TO authenticated
USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()))
WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
