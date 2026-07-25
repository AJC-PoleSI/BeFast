-- Migration 048: Suiveurs multiples par étude
--
-- Contexte : le sélecteur "Suiveur" du formulaire étude n'acceptait qu'une
-- seule personne (colonne etudes.suiveur_id). On introduit une table de
-- liaison etude_suiveurs pour permettre plusieurs suiveurs.
--
-- etudes.suiveur_id est conservé (premier suiveur sélectionné) pour la
-- compatibilité des jointures existantes (suiveur:personnes!etudes_suiveur_id_fkey)
-- et sert de valeur de repli si etude_suiveurs est vide.
--
-- ⚠️ NOTE IMPORTANTE — pas de réécriture des policies RLS ici.
-- Une version antérieure de cette migration réécrivait les policies de
-- etudes / missions / budget_etude / factures / clients pour y propager la
-- notion de suiveur multiple. C'était inutile et cassant : les migrations
-- 023_add_encryption_rls_policies.sql et 035_security_fix_critical.sql
-- n'ont JAMAIS été appliquées sur cette base (elles référencent les tables
-- mission_intervenants / equipes et les colonnes personnes.taux_horaire,
-- .poles, .metadata, .email_verified qui n'existent pas dans le schéma).
-- Les policies actives sont donc celles de 005_clients_etudes_missions.sql
-- et 024_factures_tresorerie.sql, toutes permissives (USING (true) pour les
-- utilisateurs authentifiés). Il n'y a donc aucune restriction "suiveur" à
-- préserver, et les policies posées ici suivent la même posture.
-- Un vrai durcissement RLS reste à faire, mais c'est un chantier distinct.

-- ============================================================
-- 1. TABLE DE LIAISON
-- ============================================================

CREATE TABLE IF NOT EXISTS public.etude_suiveurs (
  etude_id    UUID NOT NULL REFERENCES public.etudes(id) ON DELETE CASCADE,
  personne_id UUID NOT NULL REFERENCES public.personnes(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (etude_id, personne_id)
);

CREATE INDEX IF NOT EXISTS idx_etude_suiveurs_personne
  ON public.etude_suiveurs(personne_id);

-- Backfill depuis la colonne suiveur_id existante
INSERT INTO public.etude_suiveurs (etude_id, personne_id)
SELECT id, suiveur_id FROM public.etudes
WHERE suiveur_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. RLS (aligné sur la posture actuelle des tables liées)
-- ============================================================

ALTER TABLE public.etude_suiveurs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read etude_suiveurs" ON public.etude_suiveurs;
CREATE POLICY "authenticated read etude_suiveurs"
  ON public.etude_suiveurs FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "authenticated write etude_suiveurs" ON public.etude_suiveurs;
CREATE POLICY "authenticated write etude_suiveurs"
  ON public.etude_suiveurs FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- SCHEMA RELOAD (rafraîchit le cache PostgREST)
-- ============================================================
NOTIFY pgrst, 'reload schema';
