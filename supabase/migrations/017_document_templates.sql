-- Document templates (DOCX) with placeholders
CREATE TABLE IF NOT EXISTS public.document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  scope TEXT NOT NULL DEFAULT 'etude', -- 'etude' | 'mission' | 'personne' | 'general'
  category TEXT,                        -- libre (ex: 'contrat', 'facture', 'convention')
  file_path TEXT NOT NULL,              -- chemin dans le bucket 'templates'
  file_name TEXT NOT NULL,
  placeholders JSONB DEFAULT '[]'::jsonb, -- liste auto-détectée ex: ["etude.nom","client.nom"]
  created_by UUID REFERENCES public.personnes(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_templates_scope_idx ON public.document_templates(scope);

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_templates_read_auth" ON public.document_templates;
CREATE POLICY "document_templates_read_auth" ON public.document_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "document_templates_write_auth" ON public.document_templates;
CREATE POLICY "document_templates_write_auth" ON public.document_templates
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Documents générés / uploadés liés à une entité
CREATE TABLE IF NOT EXISTS public.generated_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.document_templates(id) ON DELETE SET NULL,
  scope TEXT NOT NULL,
  entity_id UUID NOT NULL, -- id de l'étude / mission / personne
  name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- bucket 'documents'
  file_name TEXT NOT NULL,
  created_by UUID REFERENCES public.personnes(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS generated_documents_entity_idx ON public.generated_documents(scope, entity_id);

ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "generated_documents_all_auth" ON public.generated_documents;
CREATE POLICY "generated_documents_all_auth" ON public.generated_documents
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Créer les buckets Storage via SQL (idempotent)
INSERT INTO storage.buckets (id, name, public) VALUES ('templates', 'templates', false)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false)
  ON CONFLICT (id) DO NOTHING;

-- Policies storage pour users authentifiés
DROP POLICY IF EXISTS "templates_auth_all" ON storage.objects;
CREATE POLICY "templates_auth_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'templates')
  WITH CHECK (bucket_id = 'templates');

DROP POLICY IF EXISTS "documents_auth_all" ON storage.objects;
CREATE POLICY "documents_auth_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'documents')
  WITH CHECK (bucket_id = 'documents');
