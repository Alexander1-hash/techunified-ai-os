-- Phase 4: adaptive company intelligence foundation
CREATE TABLE IF NOT EXISTS public.company_intelligence_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  snapshot_type text NOT NULL DEFAULT 'company_state',
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence text NOT NULL DEFAULT 'low',
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_intelligence_snapshots_type_check CHECK (snapshot_type IN ('company_state','signal','forecast','opportunity','risk')),
  CONSTRAINT company_intelligence_snapshots_confidence_check CHECK (confidence IN ('low','medium','high'))
);

CREATE INDEX IF NOT EXISTS company_intelligence_snapshots_org_time_idx
  ON public.company_intelligence_snapshots (organization_id, computed_at DESC);

ALTER TABLE public.company_intelligence_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_intelligence_snapshots_org_select ON public.company_intelligence_snapshots;
CREATE POLICY company_intelligence_snapshots_org_select ON public.company_intelligence_snapshots
FOR SELECT TO authenticated
USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS company_intelligence_snapshots_org_insert ON public.company_intelligence_snapshots;
CREATE POLICY company_intelligence_snapshots_org_insert ON public.company_intelligence_snapshots
FOR INSERT TO authenticated
WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
