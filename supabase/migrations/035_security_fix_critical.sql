-- Migration 035: Critical Security Fixes
-- Fixes escalade of privileges, budget exposure, and ownership checks
-- Timeline: 2026-06-10
--
-- Changes:
--   1. Expand column protection on personnes table (taux_horaire, bank_account, poles)
--   2. Fix budget_etude RLS to restrict access by etude assignment
--   3. Fix factures RLS to restrict access by role
--   4. Improve etudes RLS to require proper assignment

-- ============================================================
-- 1. EXPAND PERSONNES COLUMN PROTECTION
-- ============================================================
-- Protect additional sensitive columns from unauthorized modification

CREATE OR REPLACE FUNCTION public.guard_personnes_protected_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  jwt_role text := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'role';
BEGIN
  -- Contexts of trust: service_role, migrations, psql
  IF jwt_role IS NULL OR jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- No protected columns modified -> normal profile edit, allow it
  IF NEW.profil_type_id                 IS NOT DISTINCT FROM OLD.profil_type_id
     AND NEW.account_status             IS NOT DISTINCT FROM OLD.account_status
     AND NEW.email_verified             IS NOT DISTINCT FROM OLD.email_verified
     AND NEW.verification_token_hash    IS NOT DISTINCT FROM OLD.verification_token_hash
     AND NEW.verification_token_expires_at IS NOT DISTINCT FROM OLD.verification_token_expires_at
     AND NEW.taux_horaire               IS NOT DISTINCT FROM OLD.taux_horaire
     AND NEW.poles                      IS NOT DISTINCT FROM OLD.poles
     AND (NEW.metadata->>'bank_account' IS NOT DISTINCT FROM OLD.metadata->>'bank_account') THEN
    RETURN NEW;
  END IF;

  -- Protected columns modified: only admins can modify
  IF EXISTS (
    SELECT 1 FROM public.personnes p
    JOIN public.profils_types pt ON pt.id = p.profil_type_id
    WHERE p.id = auth.uid() AND pt.slug = 'administrateur'
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Unauthorized: cannot modify role, status, verification, hourly rate, poles, or bank account';
END;
$$;

-- Trigger already exists from migration 034, just update it
DROP TRIGGER IF EXISTS trg_guard_personnes_protected_columns ON public.personnes;
CREATE TRIGGER trg_guard_personnes_protected_columns
  BEFORE UPDATE ON public.personnes
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_personnes_protected_columns();

-- ============================================================
-- 2. FIX BUDGET_ETUDE RLS — RESTRICT BY ETUDE ASSIGNMENT
-- ============================================================

DROP POLICY IF EXISTS "auth all budget_etude"  ON public.budget_etude;
DROP POLICY IF EXISTS "auth read budget_etude" ON public.budget_etude;

CREATE POLICY "budget_etude read own etude"
  ON public.budget_etude FOR SELECT TO authenticated
  USING (
    -- User is etude suiveur
    etude_id IN (
      SELECT id FROM public.etudes
      WHERE suiveur_id = auth.uid()
    )
    OR -- User is intervenant on an etude mission
    etude_id IN (
      SELECT DISTINCT missions.etude_id
      FROM public.missions
      JOIN public.mission_intervenants
        ON mission_intervenants.mission_id = missions.id
      WHERE mission_intervenants.personne_id = auth.uid()
    )
    OR -- User is admin
    EXISTS (
      SELECT 1 FROM public.personnes p
      JOIN public.profils_types pt ON pt.id = p.profil_type_id
      WHERE p.id = auth.uid() AND pt.slug = 'administrateur'
    )
  );

-- Only etude suiveur or admin can modify budget
CREATE POLICY "budget_etude modify own"
  ON public.budget_etude FOR UPDATE TO authenticated
  USING (
    -- User is etude suiveur
    etude_id IN (
      SELECT id FROM public.etudes
      WHERE suiveur_id = auth.uid()
    )
    OR -- User is admin
    EXISTS (
      SELECT 1 FROM public.personnes p
      JOIN public.profils_types pt ON pt.id = p.profil_type_id
      WHERE p.id = auth.uid() AND pt.slug = 'administrateur'
    )
  )
  WITH CHECK (
    -- User is etude suiveur
    etude_id IN (
      SELECT id FROM public.etudes
      WHERE suiveur_id = auth.uid()
    )
    OR -- User is admin
    EXISTS (
      SELECT 1 FROM public.personnes p
      JOIN public.profils_types pt ON pt.id = p.profil_type_id
      WHERE p.id = auth.uid() AND pt.slug = 'administrateur'
    )
  );

-- ============================================================
-- 3. FIX FACTURES RLS — RESTRICT BY ROLE & OWNERSHIP
-- ============================================================

DROP POLICY IF EXISTS "authenticated read factures" ON public.factures;
DROP POLICY IF EXISTS "authenticated insert factures" ON public.factures;
DROP POLICY IF EXISTS "authenticated update factures" ON public.factures;
DROP POLICY IF EXISTS "admin delete factures" ON public.factures;

CREATE POLICY "factures read own or assigned"
  ON public.factures FOR SELECT TO authenticated
  USING (
    -- Created by user
    created_by_id = auth.uid()
    OR -- Etude suiveur can read factures for their etudes
    etude_id IN (
      SELECT id FROM public.etudes
      WHERE suiveur_id = auth.uid()
    )
    OR -- Intervenant on mission can read factures
    etude_id IN (
      SELECT DISTINCT missions.etude_id
      FROM public.missions
      JOIN public.mission_intervenants
        ON mission_intervenants.mission_id = missions.id
      WHERE mission_intervenants.personne_id = auth.uid()
    )
    OR -- Admin can read all
    EXISTS (
      SELECT 1 FROM public.personnes p
      JOIN public.profils_types pt ON pt.id = p.profil_type_id
      WHERE p.id = auth.uid() AND pt.slug = 'administrateur'
    )
  );

CREATE POLICY "factures insert own"
  ON public.factures FOR INSERT TO authenticated
  WITH CHECK (
    created_by_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.personnes p
      JOIN public.profils_types pt ON pt.id = p.profil_type_id
      WHERE p.id = auth.uid() AND pt.slug = 'administrateur'
    )
  );

CREATE POLICY "factures update own"
  ON public.factures FOR UPDATE TO authenticated
  USING (
    created_by_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.personnes p
      JOIN public.profils_types pt ON pt.id = p.profil_type_id
      WHERE p.id = auth.uid() AND pt.slug = 'administrateur'
    )
  )
  WITH CHECK (
    created_by_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.personnes p
      JOIN public.profils_types pt ON pt.id = p.profil_type_id
      WHERE p.id = auth.uid() AND pt.slug = 'administrateur'
    )
  );

CREATE POLICY "factures delete admin"
  ON public.factures FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.personnes p
      JOIN public.profils_types pt ON pt.id = p.profil_type_id
      WHERE p.id = auth.uid() AND pt.slug = 'administrateur'
    )
  );

-- ============================================================
-- 4. FIX ETUDES RLS — REQUIRE PROPER ASSIGNMENT
-- ============================================================

DROP POLICY IF EXISTS "authenticated read etudes" ON public.etudes;
DROP POLICY IF EXISTS "authenticated insert etudes" ON public.etudes;
DROP POLICY IF EXISTS "authenticated update etudes" ON public.etudes;

CREATE POLICY "etudes read assigned"
  ON public.etudes FOR SELECT TO authenticated
  USING (
    -- User is etude suiveur
    suiveur_id = auth.uid()
    OR -- User is intervenant on a mission in this etude
    id IN (
      SELECT DISTINCT missions.etude_id
      FROM public.missions
      JOIN public.mission_intervenants
        ON mission_intervenants.mission_id = missions.id
      WHERE mission_intervenants.personne_id = auth.uid()
    )
    OR -- Admin
    EXISTS (
      SELECT 1 FROM public.personnes p
      JOIN public.profils_types pt ON pt.id = p.profil_type_id
      WHERE p.id = auth.uid() AND pt.slug = 'administrateur'
    )
  );

CREATE POLICY "etudes insert auth"
  ON public.etudes FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "etudes update own"
  ON public.etudes FOR UPDATE TO authenticated
  USING (
    -- User is etude suiveur
    suiveur_id = auth.uid()
    OR -- Admin
    EXISTS (
      SELECT 1 FROM public.personnes p
      JOIN public.profils_types pt ON pt.id = p.profil_type_id
      WHERE p.id = auth.uid() AND pt.slug = 'administrateur'
    )
  )
  WITH CHECK (
    -- User is etude suiveur
    suiveur_id = auth.uid()
    OR -- Admin
    EXISTS (
      SELECT 1 FROM public.personnes p
      JOIN public.profils_types pt ON pt.id = p.profil_type_id
      WHERE p.id = auth.uid() AND pt.slug = 'administrateur'
    )
  );

-- ============================================================
-- 5. FIX CLIENTS RLS — RESTRICT TO ASSIGNED ETUDES
-- ============================================================

DROP POLICY IF EXISTS "authenticated read clients" ON public.clients;

CREATE POLICY "clients read assigned"
  ON public.clients FOR SELECT TO authenticated
  USING (
    -- Has etude on this client and is suiveur
    id IN (
      SELECT DISTINCT clients.id
      FROM public.clients
      JOIN public.etudes ON etudes.client_id = clients.id
      WHERE etudes.suiveur_id = auth.uid()
    )
    OR -- Has intervenant mission on client's etudes
    id IN (
      SELECT DISTINCT clients.id
      FROM public.clients
      JOIN public.etudes ON etudes.client_id = clients.id
      JOIN public.missions ON missions.etude_id = etudes.id
      JOIN public.mission_intervenants
        ON mission_intervenants.mission_id = missions.id
      WHERE mission_intervenants.personne_id = auth.uid()
    )
    OR -- Admin
    EXISTS (
      SELECT 1 FROM public.personnes p
      JOIN public.profils_types pt ON pt.id = p.profil_type_id
      WHERE p.id = auth.uid() AND pt.slug = 'administrateur'
    )
  );

-- ============================================================
-- SCHEMA RELOAD
-- ============================================================
NOTIFY pgrst, 'reload schema';
