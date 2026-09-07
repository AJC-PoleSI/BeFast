-- Migration 060 : ferme la RLS grande ouverte sur les documents officiels
-- (audit sécurité du 2026-09-07). Jusqu'ici, `generated_documents`,
-- `document_templates` et les buckets Storage `documents`/`templates`
-- étaient en `FOR ALL USING (auth.uid() IS NOT NULL)` : n'importe quel
-- compte authentifié (y compris un `candidat` non validé) pouvait lister,
-- télécharger et supprimer TOUS les documents de l'organisation, y compris
-- les Bulletins de Versement contenant le NSS en clair — via l'UI ou en
-- appelant directement l'API REST/Storage Supabase avec son propre JWT.
--
-- Modèle repris de la migration 050 (is_membre_interne / intervient_sur_etude
-- / is_mission_intervenant, déjà en place) : un intervenant ne voit que les
-- documents de ses propres missions/étude, un membre interne voit tout.
--
-- Le bucket Storage reste réservé aux membres internes : les intervenants
-- accèdent à leurs documents via /api/documents/[id]/download|preview, qui
-- vérifie l'autorisation en app (lib/auth/document-access.ts) puis lit le
-- fichier avec le client admin (service_role, hors RLS).

-- ── document_templates : ressource interne (modèles), jamais exposée aux intervenants
DROP POLICY IF EXISTS "document_templates_read_auth" ON public.document_templates;
DROP POLICY IF EXISTS "document_templates_write_auth" ON public.document_templates;
-- Rejouable : on retire aussi les policies que cette migration crée.
DROP POLICY IF EXISTS "document_templates_read_interne" ON public.document_templates;
DROP POLICY IF EXISTS "document_templates_write_admin" ON public.document_templates;

CREATE POLICY "document_templates_read_interne" ON public.document_templates
  FOR SELECT TO authenticated
  USING (public.is_membre_interne(auth.uid()));

CREATE POLICY "document_templates_write_admin" ON public.document_templates
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ── generated_documents : lecture interne + intervenant du projet concerné ;
--    écriture/suppression réservée aux membres internes (les documents
--    officiels ne sont jamais effacés par un intervenant).
DROP POLICY IF EXISTS "generated_documents_all_auth" ON public.generated_documents;
DROP POLICY IF EXISTS "generated_documents_read" ON public.generated_documents;
DROP POLICY IF EXISTS "generated_documents_write_interne" ON public.generated_documents;

CREATE POLICY "generated_documents_read" ON public.generated_documents
  FOR SELECT TO authenticated
  USING (
    public.is_membre_interne(auth.uid())
    OR (scope = 'etude' AND public.intervient_sur_etude(entity_id, auth.uid()))
    OR (scope = 'mission' AND public.is_mission_intervenant(entity_id, auth.uid()))
  );

CREATE POLICY "generated_documents_write_interne" ON public.generated_documents
  FOR ALL TO authenticated
  USING (public.is_membre_interne(auth.uid()))
  WITH CHECK (public.is_membre_interne(auth.uid()));

-- ── Storage : buckets 'documents' et 'templates' réservés aux membres internes.
DROP POLICY IF EXISTS "templates_auth_all" ON storage.objects;
DROP POLICY IF EXISTS "documents_auth_all" ON storage.objects;
DROP POLICY IF EXISTS "templates_interne_all" ON storage.objects;
DROP POLICY IF EXISTS "documents_interne_all" ON storage.objects;

CREATE POLICY "templates_interne_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'templates' AND public.is_membre_interne(auth.uid()))
  WITH CHECK (bucket_id = 'templates' AND public.is_membre_interne(auth.uid()));

CREATE POLICY "documents_interne_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'documents' AND public.is_membre_interne(auth.uid()))
  WITH CHECK (bucket_id = 'documents' AND public.is_membre_interne(auth.uid()));

NOTIFY pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════
-- ANNULATION (si un intervenant se retrouve bloqué de façon imprévue avant
-- que /api/documents/[id]/download|preview ne soit déployé) :
--
--   DROP POLICY IF EXISTS "document_templates_read_interne" ON public.document_templates;
--   DROP POLICY IF EXISTS "document_templates_write_admin" ON public.document_templates;
--   CREATE POLICY "document_templates_read_auth" ON public.document_templates FOR SELECT USING (auth.uid() IS NOT NULL);
--   CREATE POLICY "document_templates_write_auth" ON public.document_templates FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
--
--   DROP POLICY IF EXISTS "generated_documents_read" ON public.generated_documents;
--   DROP POLICY IF EXISTS "generated_documents_write_interne" ON public.generated_documents;
--   CREATE POLICY "generated_documents_all_auth" ON public.generated_documents FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
--
--   DROP POLICY IF EXISTS "templates_interne_all" ON storage.objects;
--   DROP POLICY IF EXISTS "documents_interne_all" ON storage.objects;
--   CREATE POLICY "templates_auth_all" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'templates') WITH CHECK (bucket_id = 'templates');
--   CREATE POLICY "documents_auth_all" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'documents') WITH CHECK (bucket_id = 'documents');
--   NOTIFY pgrst, 'reload schema';
-- ════════════════════════════════════════════════════════════
