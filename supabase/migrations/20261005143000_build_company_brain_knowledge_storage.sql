-- ============================================================
-- TECHUNIFIED AI OS
-- COMPANY BRAIN — KNOWLEDGE STORAGE FOUNDATION
-- ============================================================

CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  file_type text NOT NULL DEFAULT 'unknown',
  storage_path text NOT NULL UNIQUE,
  department_id uuid,
  status text NOT NULL DEFAULT 'Processing',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_documents_status_check
    CHECK (status IN ('Processing', 'Indexed', 'Failed'))
);

CREATE INDEX IF NOT EXISTS knowledge_documents_org_created_idx
ON public.knowledge_documents (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS knowledge_documents_org_status_idx
ON public.knowledge_documents (organization_id, status);

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_documents_org_select
ON public.knowledge_documents;
CREATE POLICY knowledge_documents_org_select
ON public.knowledge_documents
FOR SELECT TO authenticated
USING (
  organization_id = (
    SELECT p.organization_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

DROP POLICY IF EXISTS knowledge_documents_org_insert
ON public.knowledge_documents;
CREATE POLICY knowledge_documents_org_insert
ON public.knowledge_documents
FOR INSERT TO authenticated
WITH CHECK (
  organization_id = (
    SELECT p.organization_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
  AND uploaded_by = auth.uid()
);

DROP POLICY IF EXISTS knowledge_documents_org_update
ON public.knowledge_documents;
CREATE POLICY knowledge_documents_org_update
ON public.knowledge_documents
FOR UPDATE TO authenticated
USING (
  organization_id = (
    SELECT p.organization_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
)
WITH CHECK (
  organization_id = (
    SELECT p.organization_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

DROP POLICY IF EXISTS knowledge_documents_org_delete
ON public.knowledge_documents;
CREATE POLICY knowledge_documents_org_delete
ON public.knowledge_documents
FOR DELETE TO authenticated
USING (
  organization_id = (
    SELECT p.organization_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-knowledge',
  'company-knowledge',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS company_knowledge_org_select
ON storage.objects;
CREATE POLICY company_knowledge_org_select
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'company-knowledge'
  AND (storage.foldername(name))[1] = (
    SELECT p.organization_id::text
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

DROP POLICY IF EXISTS company_knowledge_org_insert
ON storage.objects;
CREATE POLICY company_knowledge_org_insert
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'company-knowledge'
  AND (storage.foldername(name))[1] = (
    SELECT p.organization_id::text
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

DROP POLICY IF EXISTS company_knowledge_org_update
ON storage.objects;
CREATE POLICY company_knowledge_org_update
ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'company-knowledge'
  AND (storage.foldername(name))[1] = (
    SELECT p.organization_id::text
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'company-knowledge'
  AND (storage.foldername(name))[1] = (
    SELECT p.organization_id::text
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

DROP POLICY IF EXISTS company_knowledge_org_delete
ON storage.objects;
CREATE POLICY company_knowledge_org_delete
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'company-knowledge'
  AND (storage.foldername(name))[1] = (
    SELECT p.organization_id::text
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

SELECT 'Company Brain knowledge storage foundation applied' AS status;
