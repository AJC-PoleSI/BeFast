-- Migration 049: FERMETURE D'UNE EXPOSITION PUBLIQUE DE DONNÉES (critique)
--
-- Constat (vérifié empiriquement le 25/07/2026 contre la base de production) :
-- la clé anon — qui est PUBLIQUE, embarquée dans le bundle JavaScript envoyé
-- au navigateur — permettait de lire sans aucune authentification :
--   * public.personnes      → 657 lignes (email, adresse, nss_encrypted, ...)
--   * public.profils_types  → 14 lignes
-- Les autres tables (etudes, clients, factures, missions, budget_etude...)
-- étaient correctement protégées : la lecture anonyme y renvoyait 0 ligne.
--
-- Cause : ces deux tables n'avaient pas de RLS effective limitant le rôle
-- `anon`, contrairement aux tables métier couvertes par la migration 005.
--
-- Correctif : RLS activée + policies réservées au rôle `authenticated`.
-- Le rôle `service_role` (utilisé par toutes les server actions et routes API
-- via createAdminClient) contourne RLS par conception : aucun impact
-- fonctionnel. Vérifié : le middleware ne lit pas `personnes`, et toutes les
-- écritures sur `personnes` passent par le service role.
--
-- ⚠️ À FAIRE EN COMPLÉMENT (hors migration) : considérer les données comme
-- potentiellement déjà collectées. Voir les recommandations transmises.
--
-- NOTE — portée volontairement limitée : cette migration ferme l'accès
-- ANONYME (la faille confirmée). Elle laisse tout utilisateur authentifié
-- lire l'annuaire des membres, ce qui correspond au comportement actuel de
-- l'application (pages profil, trésorerie). Le durcissement interne
-- (empêcher un compte `candidat` ou `intervenant` de lire les PII de tous
-- les membres) est un chantier distinct, à valider car il change ce que
-- voient ces profils.

-- ============================================================
-- 1. personnes
-- ============================================================

ALTER TABLE public.personnes ENABLE ROW LEVEL SECURITY;

-- Purge des policies existantes (noms inconnus/hétérogènes selon l'historique)
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'personnes'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.personnes', pol.policyname);
  END LOOP;
END $$;

-- Lecture : réservée aux utilisateurs authentifiés (bloque `anon`).
CREATE POLICY "personnes read authenticated"
  ON public.personnes FOR SELECT TO authenticated
  USING (true);

-- Écriture : uniquement sa propre fiche. Les opérations d'administration
-- (validation de compte, changement de rôle, campagnes mot de passe...)
-- passent par le service role et ne sont pas concernées.
CREATE POLICY "personnes update own"
  ON public.personnes FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Pas de policy INSERT ni DELETE : refusées pour anon ET authenticated
-- (création/suppression de comptes réservées au service role).

-- ============================================================
-- 2. profils_types
-- ============================================================

ALTER TABLE public.profils_types ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profils_types'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.profils_types', pol.policyname);
  END LOOP;
END $$;

-- Lecture seule pour les utilisateurs authentifiés ; écritures réservées au
-- service role (aucun accès applicatif hors createAdminClient).
CREATE POLICY "profils_types read authenticated"
  ON public.profils_types FOR SELECT TO authenticated
  USING (true);

-- ============================================================
NOTIFY pgrst, 'reload schema';
