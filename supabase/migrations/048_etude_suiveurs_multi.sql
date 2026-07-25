-- Migration 048: Suiveurs multiples par étude
--
-- Contexte : le sélecteur "Suiveur" du formulaire étude n'acceptait qu'une
-- seule personne (colonne etudes.suiveur_id). On introduit une table de
-- liaison etude_suiveurs pour permettre plusieurs suiveurs, avec les mêmes
-- droits d'accès que le suiveur unique actuel (RLS sur etudes, missions,
-- budget_etude, factures, clients).
--
-- etudes.suiveur_id est conservé (premier suiveur sélectionné) pour la
-- compatibilité des jointures existantes (suiveur:personnes!etudes_suiveur_id_fkey)
-- et sert de valeur de repli si etude_suiveurs est vide.

-- ============================================================
-- 1. TABLE DE LIAISON (créée avant les fonctions qui la référencent)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.etude_suiveurs (
  etude_id    UUID NOT NULL REFERENCES public.etudes(id) ON DELETE CASCADE,
  personne_id UUID NOT NULL REFERENCES public.personnes(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (etude_id, personne_id)
);

CREATE INDEX IF NOT EXISTS idx_etude_suiveurs_personne ON public.etude_suiveurs(personne_id);

-- Backfill depuis la colonne suiveur_id existante
INSERT INTO public.etude_suiveurs (etude_id, personne_id)
SELECT id, suiveur_id FROM public.etudes
WHERE suiveur_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE public.etude_suiveurs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. HELPERS SECURITY DEFINER (évitent la récursion RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.personnes p
    JOIN public.profils_types pt ON pt.id = p.profil_type_id
    WHERE p.id = p_user_id AND pt.slug = 'administrateur'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_etude_suiveur(p_etude_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.etude_suiveurs
    WHERE etude_id = p_etude_id AND personne_id = p_user_id
  );
$$;

DROP POLICY IF EXISTS "etude_suiveurs read" ON public.etude_suiveurs;
CREATE POLICY "etude_suiveurs read"
  ON public.etude_suiveurs FOR SELECT TO authenticated
  USING (
    personne_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.is_etude_suiveur(etude_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.missions m
      JOIN public.mission_intervenants mi ON mi.mission_id = m.id
      WHERE m.etude_id = etude_suiveurs.etude_id AND mi.personne_id = auth.uid()
    )
  );

-- Gestion (ajout/retrait) : admin, créateur de l'étude, ou un suiveur déjà en place
DROP POLICY IF EXISTS "etude_suiveurs manage" ON public.etude_suiveurs;
CREATE POLICY "etude_suiveurs manage"
  ON public.etude_suiveurs FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.is_etude_suiveur(etude_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.etudes e
      WHERE e.id = etude_suiveurs.etude_id AND e.created_by = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.is_etude_suiveur(etude_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.etudes e
      WHERE e.id = etude_suiveurs.etude_id AND e.created_by = auth.uid()
    )
  );

-- ============================================================
-- 3. RE-ÉCRITURE DES POLICIES QUI TESTAIENT suiveur_id = auth.uid()
-- ============================================================

-- 023_add_encryption_rls_policies.sql -----------------------------------

DROP POLICY IF EXISTS "users_can_read_own_etude_encrypted_data" ON public.etudes;
CREATE POLICY "users_can_read_own_etude_encrypted_data"
  ON public.etudes FOR SELECT
  USING (
    public.is_etude_suiveur(etudes.id, auth.uid())
    OR (
      EXISTS (
        SELECT 1 FROM public.personnes p
        WHERE p.id = auth.uid()
        AND p.profil_type_id IN (SELECT id FROM public.profils_types WHERE slug = 'manager')
      )
      AND EXISTS (
        SELECT 1 FROM public.equipes eq
        JOIN public.etude_suiveurs es ON es.personne_id = eq.membre_id
        WHERE eq.manager_id = auth.uid() AND es.etude_id = etudes.id
      )
    )
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "users_can_update_own_etude_encrypted_data" ON public.etudes;
CREATE POLICY "users_can_update_own_etude_encrypted_data"
  ON public.etudes FOR UPDATE
  USING (
    public.is_etude_suiveur(etudes.id, auth.uid())
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "users_can_read_own_mission_encrypted_data" ON public.missions;
CREATE POLICY "users_can_read_own_mission_encrypted_data"
  ON public.missions FOR SELECT
  USING (
    id IN (SELECT mission_id FROM public.mission_intervenants WHERE personne_id = auth.uid())
    OR public.is_etude_suiveur(missions.etude_id, auth.uid())
    OR (
      EXISTS (
        SELECT 1 FROM public.personnes p
        WHERE p.id = auth.uid()
        AND p.profil_type_id IN (SELECT id FROM public.profils_types WHERE slug = 'manager')
      )
      AND EXISTS (
        SELECT 1 FROM public.mission_intervenants mi
        JOIN public.equipes e ON mi.personne_id = e.membre_id
        WHERE mi.mission_id = missions.id AND e.manager_id = auth.uid()
      )
    )
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "users_can_update_own_mission_encrypted_data" ON public.missions;
CREATE POLICY "users_can_update_own_mission_encrypted_data"
  ON public.missions FOR UPDATE
  USING (
    public.is_etude_suiveur(missions.etude_id, auth.uid())
    OR public.is_admin(auth.uid())
  );

-- 035_security_fix_critical.sql ------------------------------------------

DROP POLICY IF EXISTS "budget_etude read own etude" ON public.budget_etude;
CREATE POLICY "budget_etude read own etude"
  ON public.budget_etude FOR SELECT TO authenticated
  USING (
    etude_id IN (SELECT etude_id FROM public.etude_suiveurs WHERE personne_id = auth.uid())
    OR etude_id IN (
      SELECT DISTINCT missions.etude_id
      FROM public.missions
      JOIN public.mission_intervenants ON mission_intervenants.mission_id = missions.id
      WHERE mission_intervenants.personne_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "budget_etude modify own" ON public.budget_etude;
CREATE POLICY "budget_etude modify own"
  ON public.budget_etude FOR UPDATE TO authenticated
  USING (
    etude_id IN (SELECT etude_id FROM public.etude_suiveurs WHERE personne_id = auth.uid())
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    etude_id IN (SELECT etude_id FROM public.etude_suiveurs WHERE personne_id = auth.uid())
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "factures read own or assigned" ON public.factures;
CREATE POLICY "factures read own or assigned"
  ON public.factures FOR SELECT TO authenticated
  USING (
    created_by_id = auth.uid()
    OR etude_id IN (SELECT etude_id FROM public.etude_suiveurs WHERE personne_id = auth.uid())
    OR etude_id IN (
      SELECT DISTINCT missions.etude_id
      FROM public.missions
      JOIN public.mission_intervenants ON mission_intervenants.mission_id = missions.id
      WHERE mission_intervenants.personne_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "etudes read assigned" ON public.etudes;
CREATE POLICY "etudes read assigned"
  ON public.etudes FOR SELECT TO authenticated
  USING (
    public.is_etude_suiveur(etudes.id, auth.uid())
    OR id IN (
      SELECT DISTINCT missions.etude_id
      FROM public.missions
      JOIN public.mission_intervenants ON mission_intervenants.mission_id = missions.id
      WHERE mission_intervenants.personne_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "etudes update own" ON public.etudes;
CREATE POLICY "etudes update own"
  ON public.etudes FOR UPDATE TO authenticated
  USING (
    public.is_etude_suiveur(etudes.id, auth.uid())
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    public.is_etude_suiveur(etudes.id, auth.uid())
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "clients read assigned" ON public.clients;
CREATE POLICY "clients read assigned"
  ON public.clients FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT DISTINCT clients.id
      FROM public.clients
      JOIN public.etudes ON etudes.client_id = clients.id
      JOIN public.etude_suiveurs ON etude_suiveurs.etude_id = etudes.id
      WHERE etude_suiveurs.personne_id = auth.uid()
    )
    OR id IN (
      SELECT DISTINCT clients.id
      FROM public.clients
      JOIN public.etudes ON etudes.client_id = clients.id
      JOIN public.missions ON missions.etude_id = etudes.id
      JOIN public.mission_intervenants ON mission_intervenants.mission_id = missions.id
      WHERE mission_intervenants.personne_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

-- ============================================================
-- SCHEMA RELOAD
-- ============================================================
NOTIFY pgrst, 'reload schema';
