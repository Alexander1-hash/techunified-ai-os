-- Phase 4 completion: forecast evaluation
CREATE TABLE IF NOT EXISTS public.company_intelligence_forecast_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  snapshot_id uuid NOT NULL REFERENCES public.company_intelligence_snapshots(id) ON DELETE CASCADE,
  objective_id uuid NOT NULL REFERENCES public.company_objectives(id) ON DELETE CASCADE,
  predicted_progress numeric NOT NULL,
  observed_progress numeric NOT NULL,
  absolute_error numeric NOT NULL,
  accuracy_score numeric NOT NULL,
  prediction_confidence text NOT NULL,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_intelligence_forecast_evaluations_confidence_check CHECK (prediction_confidence IN ('low','medium','high')),
  CONSTRAINT company_intelligence_forecast_evaluations_score_check CHECK (accuracy_score >= 0 AND accuracy_score <= 100),
  CONSTRAINT company_intelligence_forecast_evaluations_unique UNIQUE (snapshot_id, objective_id)
);

CREATE INDEX IF NOT EXISTS company_intelligence_forecast_evaluations_org_time_idx
  ON public.company_intelligence_forecast_evaluations (organization_id, evaluated_at DESC);

ALTER TABLE public.company_intelligence_forecast_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_intelligence_forecast_evaluations_org_select ON public.company_intelligence_forecast_evaluations;
CREATE POLICY company_intelligence_forecast_evaluations_org_select ON public.company_intelligence_forecast_evaluations
FOR SELECT TO authenticated
USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS company_intelligence_forecast_evaluations_org_insert ON public.company_intelligence_forecast_evaluations;
CREATE POLICY company_intelligence_forecast_evaluations_org_insert ON public.company_intelligence_forecast_evaluations
FOR INSERT TO authenticated
WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
