-- Migration 051: SECONDE EXPOSITION PUBLIQUE (critique) + tables sans RLS
--
-- Constat (vérifié empiriquement le 25/07/2026 contre la production, APRÈS
-- application de 049 et 050) :
--   public.documents_personnes → 5 lignes sur 5 lisibles par la clé ANON,
--   c'est-à-dire les documents personnels des membres (type, nom de fichier,
--   chemin de stockage, statut) accessibles sans aucune authentification.
--
-- 049 avait fermé `personnes` et `profils_types` ; 050 a cloisonné le métier.
-- Cette table-ci n'était couverte par aucune des deux : elle n'a jamais eu de
-- policy dans l'historique des migrations, donc RLS n'y filtrait rien.
--
-- Sont également verrouillées ici, par prévention, les tables actuellement
-- VIDES et sans policy connue — le test anonyme y était non concluant faute
-- de données, mais elles suivent le même schéma d'oubli et recevront des
-- données sensibles (demandes de signature, documents de mission, liaison
-- de comptes RH).

-- ============================================================
-- 1. documents_personnes  ← FUITE ACTIVE
-- ============================================================
-- Documents personnels : chacun voit les siens, les membres internes voient
-- tout (validation des dossiers), les écritures passent par le service role.

ALTER TABLE public.documents_personnes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
             WHERE schemaname='public' AND tablename='documents_personnes'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.documents_personnes', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "documents_personnes read" ON public.documents_personnes
  FOR SELECT TO authenticated
  USING (personne_id = auth.uid() OR public.is_membre_interne(auth.uid()));

CREATE POLICY "documents_personnes insert own" ON public.documents_personnes
  FOR INSERT TO authenticated
  WITH CHECK (personne_id = auth.uid());

CREATE POLICY "documents_personnes delete" ON public.documents_personnes
  FOR DELETE TO authenticated
  USING (personne_id = auth.uid() OR public.is_admin(auth.uid()));

-- ============================================================
-- 2. Tables vides sans RLS — verrouillage préventif
-- ============================================================

-- Demandes de signature électronique (contient des emails de destinataires)
ALTER TABLE public.signature_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "signature_requests interne" ON public.signature_requests;
CREATE POLICY "signature_requests interne" ON public.signature_requests
  FOR ALL TO authenticated
  USING (public.is_membre_interne(auth.uid()))
  WITH CHECK (public.is_membre_interne(auth.uid()));

-- Liaison de comptes Befast ↔ RH Manager : service role exclusivement
-- (aucune policy = tout accès `authenticated` refusé, conformément au
-- commentaire de la migration 044).
ALTER TABLE public.account_links ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
             WHERE schemaname='public' AND tablename='account_links'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.account_links', pol.policyname);
  END LOOP;
END $$;

-- Documents et checklist de mission : réservés aux intervenants de la
-- collaboration concernée et aux membres internes.
ALTER TABLE public.mission_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mission_documents access" ON public.mission_documents;
CREATE POLICY "mission_documents access" ON public.mission_documents
  FOR ALL TO authenticated
  USING (
    public.is_membre_interne(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.mission_collaborations mc
      WHERE mc.id = mission_documents.mission_collaboration_id
        AND mc.intervenant_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_membre_interne(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.mission_collaborations mc
      WHERE mc.id = mission_documents.mission_collaboration_id
        AND mc.intervenant_id = auth.uid()
    )
  );

ALTER TABLE public.mission_checklist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mission_checklist access" ON public.mission_checklist;
CREATE POLICY "mission_checklist access" ON public.mission_checklist
  FOR ALL TO authenticated
  USING (
    public.is_membre_interne(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.mission_collaborations mc
      WHERE mc.id = mission_checklist.mission_collaboration_id
        AND mc.intervenant_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_membre_interne(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.mission_collaborations mc
      WHERE mc.id = mission_checklist.mission_collaboration_id
        AND mc.intervenant_id = auth.uid()
    )
  );

ALTER TABLE public.mission_collaborations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mission_collaborations access" ON public.mission_collaborations;
CREATE POLICY "mission_collaborations access" ON public.mission_collaborations
  FOR ALL TO authenticated
  USING (public.is_membre_interne(auth.uid()) OR intervenant_id = auth.uid())
  WITH CHECK (public.is_membre_interne(auth.uid()));

-- Champs personnalisés : définitions lisibles par tous les authentifiés,
-- valeurs limitées à leur propriétaire (et aux internes).
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "custom_fields read" ON public.custom_fields;
CREATE POLICY "custom_fields read" ON public.custom_fields
  FOR SELECT TO authenticated USING (true);

ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "custom_field_values access" ON public.custom_field_values;
CREATE POLICY "custom_field_values access" ON public.custom_field_values
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_membre_interne(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_membre_interne(auth.uid()));

NOTIFY pgrst, 'reload schema';
