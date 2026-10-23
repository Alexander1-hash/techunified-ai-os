-- Harden forecast evaluation integrity.
-- Evaluations are immutable once recorded: the application uses conflict-ignore
-- semantics, so retries cannot rewrite the historical prediction/outcome pair.

ALTER TABLE public.company_intelligence_forecast_evaluations
  ADD CONSTRAINT company_intelligence_forecast_evaluations_predicted_progress_check
    CHECK (predicted_progress >= 0 AND predicted_progress <= 100),
  ADD CONSTRAINT company_intelligence_forecast_evaluations_observed_progress_check
    CHECK (observed_progress >= 0 AND observed_progress <= 100),
  ADD CONSTRAINT company_intelligence_forecast_evaluations_absolute_error_check
    CHECK (
      absolute_error >= 0
      AND absolute_error <= 100
      AND abs(absolute_error - abs(predicted_progress - observed_progress)) <= 0.01
    ),
  ADD CONSTRAINT company_intelligence_forecast_evaluations_accuracy_consistency_check
    CHECK (
      abs(
        accuracy_score
        - greatest(0::numeric, least(100::numeric, 100::numeric - absolute_error))
      ) <= 0.01
    );

CREATE OR REPLACE FUNCTION public.validate_company_forecast_evaluation_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  snapshot_organization_id uuid;
  objective_organization_id uuid;
BEGIN
  SELECT organization_id
    INTO snapshot_organization_id
    FROM public.company_intelligence_snapshots
    WHERE id = NEW.snapshot_id;

  IF snapshot_organization_id IS NULL OR snapshot_organization_id <> NEW.organization_id THEN
    RAISE EXCEPTION 'Forecast evaluation snapshot must belong to the same organization'
      USING ERRCODE = '23514';
  END IF;

  SELECT organization_id
    INTO objective_organization_id
    FROM public.company_objectives
    WHERE id = NEW.objective_id;

  IF objective_organization_id IS NULL OR objective_organization_id <> NEW.organization_id THEN
    RAISE EXCEPTION 'Forecast evaluation objective must belong to the same organization'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_company_forecast_evaluation_scope
  ON public.company_intelligence_forecast_evaluations;

CREATE TRIGGER validate_company_forecast_evaluation_scope
  BEFORE INSERT OR UPDATE ON public.company_intelligence_forecast_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.validate_company_forecast_evaluation_scope();

-- Do not add UPDATE or DELETE policies. Forecast evaluations are an audit trail.
-- The authenticated application may read and append records within its own org.
