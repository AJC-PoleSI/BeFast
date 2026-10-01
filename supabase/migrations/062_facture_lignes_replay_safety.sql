-- Migration 062 : la migration 050 boucle sur
-- ['factures','facture_lignes','budget_etude','proposals','proposal_phases',
-- 'marges_recommandees'] et exécute `ALTER TABLE ... ENABLE ROW LEVEL
-- SECURITY` sans garde d'existence. Or aucune migration du dépôt ne crée
-- `facture_lignes` (audit sécurité du 2026-09-07) : si cette table n'existe
-- pas dans l'environnement où 050 est rejouée (nouvel environnement,
-- restauration), le bloc DO $$ échoue et ANNULE la fermeture RLS des 5
-- AUTRES tables (factures, budget_etude, proposals, proposal_phases,
-- marges_recommandees) — le correctif de cloisonnement le plus critique du
-- projet ne serait alors PAS appliqué, silencieusement.
--
-- ⚠️ Si `facture_lignes` existe déjà dans l'environnement cible, cette
-- migration est un no-op inoffensif (le bloc ci-dessous ne fait rien de plus
-- que ce que 050 a déjà fait). Vérifier côté dashboard Supabase si la table
-- existe réellement : si non, elle est soit inutilisée (à supprimer de la
-- liste dans une future révision de 050), soit un schéma manquant à créer —
-- à trancher avec Felix, pas de suppression/création automatique ici.

DO $$
BEGIN
  IF to_regclass('public.facture_lignes') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.facture_lignes ENABLE ROW LEVEL SECURITY';
    EXECUTE (
      SELECT COALESCE(
        string_agg(format('DROP POLICY %I ON public.facture_lignes', policyname), '; '),
        'SELECT 1'
      )
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'facture_lignes'
    );
    EXECUTE 'CREATE POLICY "facture_lignes interne only" ON public.facture_lignes FOR ALL TO authenticated
               USING (public.is_membre_interne(auth.uid()))
               WITH CHECK (public.is_membre_interne(auth.uid()))';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
