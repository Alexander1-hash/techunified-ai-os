-- ============================================================
-- TECHUNIFIED AI OS
-- COMPANY BRAIN — STORAGE RLS RELIABILITY FIX
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.organization_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_user_organization_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_organization_id() TO authenticated;

DROP POLICY IF EXISTS knowledge_documents_org_select
ON public.knowledge_documents;
CREATE POLICY knowledge_documents_org_select
ON public.knowledge_documents
FOR SELECT TO authenticated
USING (
  organization_id = public.current_user_organization_id()
);

DROP POLICY IF EXISTS knowledge_documents_org_insert
ON public.knowledge_documents;
CREATE POLICY knowledge_documents_org_insert
ON public.knowledge_documents
FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.current_user_organization_id()
  AND uploaded_by = auth.uid()
);

DROP POLICY IF EXISTS knowledge_documents_org_update
ON public.knowledge_documents;
CREATE POLICY knowledge_documents_org_update
ON public.knowledge_documents
FOR UPDATE TO authenticated
USING (
  organization_id = public.current_user_organization_id()
)
WITH CHECK (
  organization_id = public.current_user_organization_id()
);

DROP POLICY IF EXISTS knowledge_documents_org_delete
ON public.knowledge_documents;
CREATE POLICY knowledge_documents_org_delete
ON public.knowledge_documents
FOR DELETE TO authenticated
USING (
  organization_id = public.current_user_organization_id()
);

DROP POLICY IF EXISTS company_knowledge_org_select
ON storage.objects;
CREATE POLICY company_knowledge_org_select
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'company-knowledge'
  AND (storage.foldername(name))[1] =
    public.current_user_organization_id()::text
);

DROP POLICY IF EXISTS company_knowledge_org_insert
ON storage.objects;
CREATE POLICY company_knowledge_org_insert
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'company-knowledge'
  AND (storage.foldername(name))[1] =
    public.current_user_organization_id()::text
);

DROP POLICY IF EXISTS company_knowledge_org_update
ON storage.objects;
CREATE POLICY company_knowledge_org_update
ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'company-knowledge'
  AND (storage.foldername(name))[1] =
    public.current_user_organization_id()::text
)
WITH CHECK (
  bucket_id = 'company-knowledge'
  AND (storage.foldername(name))[1] =
    public.current_user_organization_id()::text
);

DROP POLICY IF EXISTS company_knowledge_org_delete
ON storage.objects;
CREATE POLICY company_knowledge_org_delete
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'company-knowledge'
  AND (storage.foldername(name))[1] =
    public.current_user_organization_id()::text
);

SELECT 'Company Brain storage RLS reliability fix applied' AS status;
