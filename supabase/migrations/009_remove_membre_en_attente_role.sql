-- ============================================================
-- 009_remove_membre_en_attente_role.sql
-- "Membre en validation" must NOT be a role — it is an account_status.
-- Remove the rogue role and let account_status handle pending state.
-- ============================================================

-- 1. Nullify profil_type_id for any user currently assigned this role
UPDATE public.personnes
SET profil_type_id = NULL
WHERE profil_type_id = (
  SELECT id FROM public.profils_types WHERE slug = 'membre_en_attente' LIMIT 1
);

-- 2. Delete the role itself
DELETE FROM public.profils_types
WHERE slug = 'membre_en_attente';
