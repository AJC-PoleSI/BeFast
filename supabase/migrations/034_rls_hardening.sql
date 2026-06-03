-- Migration 034: Durcissement RLS — empêcher la modification directe de la BDD
--
-- Contexte : la clé anon est publique (extractible du bundle du site déployé).
-- N'importe quel membre authentifié peut donc taper l'API REST Supabase
-- directement (en local), en contournant l'app Next.js et son système de
-- permissions (qui n'était appliqué que côté UI / server actions).
--
-- Deux problèmes corrigés ici :
--   1. (CRITIQUE) Escalade de privilèges : un membre pouvait s'auto-promouvoir
--      admin / s'auto-valider via UPDATE personnes SET profil_type_id=...,
--      account_status='validated', email_verified=true WHERE id = auth.uid().
--   2. (ÉLEVÉ) Écriture directe de proposals / proposal_phases / budget_etude
--      grâce à des policies "USING (true)" trop permissives.

-- ============================================================
-- 1. FAILLE CRITIQUE : escalade de privilèges sur public.personnes
-- ============================================================
-- La policy "users update own profile" autorise un utilisateur à modifier sa
-- propre ligne sans restriction de colonnes. On ajoute un trigger qui interdit
-- la modification des colonnes sensibles, sauf :
--   - appels service_role (server actions / API routes = gardiens applicatifs),
--   - accès sans JWT (migrations / psql),
--   - administrateurs réels (vérifiés en base, pas via un claim JWT falsifiable).

CREATE OR REPLACE FUNCTION public.guard_personnes_protected_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  jwt_role text := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'role';
BEGIN
  -- Contextes de confiance.
  IF jwt_role IS NULL OR jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Aucune colonne protégée modifiée -> édition de profil normale, on laisse passer.
  IF NEW.profil_type_id                 IS NOT DISTINCT FROM OLD.profil_type_id
     AND NEW.account_status             IS NOT DISTINCT FROM OLD.account_status
     AND NEW.email_verified             IS NOT DISTINCT FROM OLD.email_verified
     AND NEW.verification_token_hash    IS NOT DISTINCT FROM OLD.verification_token_hash
     AND NEW.verification_token_expires_at IS NOT DISTINCT FROM OLD.verification_token_expires_at THEN
    RETURN NEW;
  END IF;

  -- Modification de colonnes protégées : réservée à un administrateur réel.
  IF EXISTS (
    SELECT 1 FROM public.personnes p
    JOIN public.profils_types pt ON pt.id = p.profil_type_id
    WHERE p.id = auth.uid() AND pt.slug = 'administrateur'
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Modification non autorisée des colonnes de rôle / statut / vérification email';
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_personnes_protected_columns ON public.personnes;
CREATE TRIGGER trg_guard_personnes_protected_columns
  BEFORE UPDATE ON public.personnes
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_personnes_protected_columns();

-- ============================================================
-- 2. FAILLE ÉLEVÉE : écriture directe non autorisée
-- ============================================================
-- Ces tables ne sont écrites que par les server actions (propositions.ts), qui
-- passent désormais par le client service_role (lequel ignore la RLS). On retire
-- donc le droit d'ÉCRITURE aux rôles authenticated, tout en CONSERVANT la lecture
-- (l'UI lit ces données via le navigateur).

-- budget_etude : "FOR ALL" (lecture + écriture + suppression) -> lecture seule
DROP POLICY IF EXISTS "auth all budget_etude"  ON public.budget_etude;
DROP POLICY IF EXISTS "auth read budget_etude" ON public.budget_etude;
CREATE POLICY "auth read budget_etude"
  ON public.budget_etude FOR SELECT TO authenticated USING (true);

-- proposals : on retire INSERT et UPDATE pour authenticated.
-- "proposals read" (SELECT) et "proposals delete" (admin only) sont conservés.
DROP POLICY IF EXISTS "proposals insert" ON public.proposals;
DROP POLICY IF EXISTS "proposals update" ON public.proposals;

-- proposal_phases : "FOR ALL" -> lecture seule
DROP POLICY IF EXISTS "proposal_phases all"  ON public.proposal_phases;
DROP POLICY IF EXISTS "proposal_phases read" ON public.proposal_phases;
CREATE POLICY "proposal_phases read"
  ON public.proposal_phases FOR SELECT TO authenticated USING (true);

NOTIFY pgrst, 'reload schema';
