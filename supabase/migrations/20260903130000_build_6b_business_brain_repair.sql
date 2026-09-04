-- Build 6B repair: add only missing constraints, indexes, trigger wiring, and RLS policies.
-- Existing tables, columns, primary keys, and RLS enablement are intentionally untouched.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_objectives_organization_id_fkey') THEN
    ALTER TABLE public.company_objectives
      ADD CONSTRAINT company_objectives_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_objectives_owner_department_id_fkey') THEN
    ALTER TABLE public.company_objectives
      ADD CONSTRAINT company_objectives_owner_department_id_fkey
      FOREIGN KEY (owner_department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_kpis_organization_id_fkey') THEN
    ALTER TABLE public.business_kpis
      ADD CONSTRAINT business_kpis_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_insights_organization_id_fkey') THEN
    ALTER TABLE public.business_insights
      ADD CONSTRAINT business_insights_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_recommendations_organization_id_fkey') THEN
    ALTER TABLE public.business_recommendations
      ADD CONSTRAINT business_recommendations_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_reports_organization_id_fkey') THEN
    ALTER TABLE public.business_reports
      ADD CONSTRAINT business_reports_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_reports_created_by_fkey') THEN
    ALTER TABLE public.business_reports
      ADD CONSTRAINT business_reports_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_data_sources_organization_id_fkey') THEN
    ALTER TABLE public.business_data_sources
      ADD CONSTRAINT business_data_sources_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS company_objectives_organization_id_idx ON public.company_objectives (organization_id);
CREATE INDEX IF NOT EXISTS business_kpis_organization_id_idx ON public.business_kpis (organization_id);
CREATE INDEX IF NOT EXISTS business_insights_organization_id_idx ON public.business_insights (organization_id);
CREATE INDEX IF NOT EXISTS business_recommendations_organization_id_idx ON public.business_recommendations (organization_id);
CREATE INDEX IF NOT EXISTS business_reports_organization_id_idx ON public.business_reports (organization_id);
CREATE INDEX IF NOT EXISTS business_data_sources_organization_id_idx ON public.business_data_sources (organization_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
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
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'company_objectives_set_updated_at' AND tgrelid = 'public.company_objectives'::regclass) THEN
    CREATE TRIGGER company_objectives_set_updated_at BEFORE UPDATE ON public.company_objectives FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'business_kpis_set_updated_at' AND tgrelid = 'public.business_kpis'::regclass) THEN
    CREATE TRIGGER business_kpis_set_updated_at BEFORE UPDATE ON public.business_kpis FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'business_insights_set_updated_at' AND tgrelid = 'public.business_insights'::regclass) THEN
    CREATE TRIGGER business_insights_set_updated_at BEFORE UPDATE ON public.business_insights FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'business_recommendations_set_updated_at' AND tgrelid = 'public.business_recommendations'::regclass) THEN
    CREATE TRIGGER business_recommendations_set_updated_at BEFORE UPDATE ON public.business_recommendations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'business_reports_set_updated_at' AND tgrelid = 'public.business_reports'::regclass) THEN
    CREATE TRIGGER business_reports_set_updated_at BEFORE UPDATE ON public.business_reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'business_data_sources_set_updated_at' AND tgrelid = 'public.business_data_sources'::regclass) THEN
    CREATE TRIGGER business_data_sources_set_updated_at BEFORE UPDATE ON public.business_data_sources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

ALTER TABLE public.company_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_data_sources ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'company_objectives' AND policyname = 'company_objectives_org_select') THEN
    CREATE POLICY company_objectives_org_select ON public.company_objectives FOR SELECT TO authenticated USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'company_objectives' AND policyname = 'company_objectives_org_insert') THEN
    CREATE POLICY company_objectives_org_insert ON public.company_objectives FOR INSERT TO authenticated WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'company_objectives' AND policyname = 'company_objectives_org_update') THEN
    CREATE POLICY company_objectives_org_update ON public.company_objectives FOR UPDATE TO authenticated USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid()))) WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'company_objectives' AND policyname = 'company_objectives_org_delete') THEN
    CREATE POLICY company_objectives_org_delete ON public.company_objectives FOR DELETE TO authenticated USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid())));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_kpis' AND policyname = 'business_kpis_org_select') THEN
    CREATE POLICY business_kpis_org_select ON public.business_kpis FOR SELECT TO authenticated USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_kpis' AND policyname = 'business_kpis_org_insert') THEN
    CREATE POLICY business_kpis_org_insert ON public.business_kpis FOR INSERT TO authenticated WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_kpis' AND policyname = 'business_kpis_org_update') THEN
    CREATE POLICY business_kpis_org_update ON public.business_kpis FOR UPDATE TO authenticated USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid()))) WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_kpis' AND policyname = 'business_kpis_org_delete') THEN
    CREATE POLICY business_kpis_org_delete ON public.business_kpis FOR DELETE TO authenticated USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid())));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_insights' AND policyname = 'business_insights_org_select') THEN
    CREATE POLICY business_insights_org_select ON public.business_insights FOR SELECT TO authenticated USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_insights' AND policyname = 'business_insights_org_insert') THEN
    CREATE POLICY business_insights_org_insert ON public.business_insights FOR INSERT TO authenticated WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_insights' AND policyname = 'business_insights_org_update') THEN
    CREATE POLICY business_insights_org_update ON public.business_insights FOR UPDATE TO authenticated USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid()))) WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_insights' AND policyname = 'business_insights_org_delete') THEN
    CREATE POLICY business_insights_org_delete ON public.business_insights FOR DELETE TO authenticated USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid())));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_recommendations' AND policyname = 'business_recommendations_org_select') THEN
    CREATE POLICY business_recommendations_org_select ON public.business_recommendations FOR SELECT TO authenticated USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_recommendations' AND policyname = 'business_recommendations_org_insert') THEN
    CREATE POLICY business_recommendations_org_insert ON public.business_recommendations FOR INSERT TO authenticated WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_recommendations' AND policyname = 'business_recommendations_org_update') THEN
    CREATE POLICY business_recommendations_org_update ON public.business_recommendations FOR UPDATE TO authenticated USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid()))) WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_recommendations' AND policyname = 'business_recommendations_org_delete') THEN
    CREATE POLICY business_recommendations_org_delete ON public.business_recommendations FOR DELETE TO authenticated USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid())));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_reports' AND policyname = 'business_reports_org_select') THEN
    CREATE POLICY business_reports_org_select ON public.business_reports FOR SELECT TO authenticated USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_reports' AND policyname = 'business_reports_org_insert') THEN
    CREATE POLICY business_reports_org_insert ON public.business_reports FOR INSERT TO authenticated WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_reports' AND policyname = 'business_reports_org_update') THEN
    CREATE POLICY business_reports_org_update ON public.business_reports FOR UPDATE TO authenticated USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid()))) WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_reports' AND policyname = 'business_reports_org_delete') THEN
    CREATE POLICY business_reports_org_delete ON public.business_reports FOR DELETE TO authenticated USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid())));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_data_sources' AND policyname = 'business_data_sources_org_select') THEN
    CREATE POLICY business_data_sources_org_select ON public.business_data_sources FOR SELECT TO authenticated USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_data_sources' AND policyname = 'business_data_sources_org_insert') THEN
    CREATE POLICY business_data_sources_org_insert ON public.business_data_sources FOR INSERT TO authenticated WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_data_sources' AND policyname = 'business_data_sources_org_update') THEN
    CREATE POLICY business_data_sources_org_update ON public.business_data_sources FOR UPDATE TO authenticated USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid()))) WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_data_sources' AND policyname = 'business_data_sources_org_delete') THEN
    CREATE POLICY business_data_sources_org_delete ON public.business_data_sources FOR DELETE TO authenticated USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid())));
  END IF;
END $$;
