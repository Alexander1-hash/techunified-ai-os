-- Business Outcomes: measurable customer value and ROI evidence.
CREATE TABLE IF NOT EXISTS public.business_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  outcome_type text NOT NULL,
  baseline_value numeric,
  current_value numeric,
  unit text,
  hours_saved numeric NOT NULL DEFAULT 0,
  cost_avoided numeric NOT NULL DEFAULT 0,
  revenue_impact numeric NOT NULL DEFAULT 0,
  implementation_cost numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  evidence_status text NOT NULL DEFAULT 'estimated',
  source text,
  notes text,
  period_start date,
  period_end date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_outcomes_type_check CHECK (
    outcome_type IN ('cost_saving','productivity','revenue_opportunity','efficiency','error_reduction','risk_reduction','other')
  ),
  CONSTRAINT business_outcomes_evidence_check CHECK (
    evidence_status IN ('measured','estimated','attributed')
  )
);

CREATE INDEX IF NOT EXISTS business_outcomes_organization_id_idx
  ON public.business_outcomes (organization_id);

CREATE INDEX IF NOT EXISTS business_outcomes_created_at_idx
  ON public.business_outcomes (created_at DESC);

ALTER TABLE public.business_outcomes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'business_outcomes'
      AND policyname = 'business_outcomes_org_select'
  ) THEN
    CREATE POLICY business_outcomes_org_select
      ON public.business_outcomes FOR SELECT TO authenticated
      USING (
        organization_id = (
          SELECT p.organization_id
          FROM public.profiles p
          WHERE p.id = (SELECT auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'business_outcomes'
      AND policyname = 'business_outcomes_org_insert'
  ) THEN
    CREATE POLICY business_outcomes_org_insert
      ON public.business_outcomes FOR INSERT TO authenticated
      WITH CHECK (
        organization_id = (
          SELECT p.organization_id
          FROM public.profiles p
          WHERE p.id = (SELECT auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'business_outcomes'
      AND policyname = 'business_outcomes_org_update'
  ) THEN
    CREATE POLICY business_outcomes_org_update
      ON public.business_outcomes FOR UPDATE TO authenticated
      USING (
        organization_id = (
          SELECT p.organization_id
          FROM public.profiles p
          WHERE p.id = (SELECT auth.uid())
        )
      )
      WITH CHECK (
        organization_id = (
          SELECT p.organization_id
          FROM public.profiles p
          WHERE p.id = (SELECT auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'business_outcomes'
      AND policyname = 'business_outcomes_org_delete'
  ) THEN
    CREATE POLICY business_outcomes_org_delete
      ON public.business_outcomes FOR DELETE TO authenticated
      USING (
        organization_id = (
          SELECT p.organization_id
          FROM public.profiles p
          WHERE p.id = (SELECT auth.uid())
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'set_updated_at'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    CREATE FUNCTION public.set_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = public
    AS $function$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $function$;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'business_outcomes_set_updated_at'
      AND tgrelid = 'public.business_outcomes'::regclass
  ) THEN
    CREATE TRIGGER business_outcomes_set_updated_at
      BEFORE UPDATE ON public.business_outcomes
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
