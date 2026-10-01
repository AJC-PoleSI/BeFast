-- 069_rls_parametres_et_templates_par_permission.sql
--
-- Aligne la RLS sur le catalogue de permissions applicatif (cartographie des
-- rôles du 2026-09-12). Deux tables restaient verrouillées sur le seul rôle de
-- base « administrateur » alors que l'application, elle, ouvre désormais ces
-- écrans à des postes (bureau/pôles) :
--
--   1. `parametres` — paramètres de la structure (identité, bureau, banque,
--      TVA, cotisations, liste des pôles). Portés par `parametres_structure`
--      (Présidente, Pôle Trésorerie). Les écritures passent par
--      `setParametre` / `setParametres` (lib/actions/etudes.ts) avec le client
--      utilisateur : sans cette migration, le garde applicatif laisse passer
--      mais la RLS renvoie une erreur.
--
--   2. `document_templates` — modèles Word/PDF. Portés par `gerer_parametres`
--      (paramétrage avancé), écrits via `deleteTemplate` /
--      `updateTemplateMeta` (lib/actions/documents.ts), client utilisateur
--      également.
--
-- `public.has_permission(uuid, text)` (migration 055) renvoie déjà `true` pour
-- un administrateur et couvre le cumul rôle de base ∪ postes : les
-- administrateurs conservent donc exactement leurs droits actuels.
--
-- Rejouable sans effet de bord.

-- ── parametres : lecture inchangée (tout compte authentifié), écriture élargie
DROP POLICY IF EXISTS "admin write parametres" ON public.parametres;
DROP POLICY IF EXISTS "parametres write parametres_structure" ON public.parametres;

CREATE POLICY "parametres write parametres_structure" ON public.parametres
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'parametres_structure'))
  WITH CHECK (public.has_permission(auth.uid(), 'parametres_structure'));

-- ── document_templates : lecture interne inchangée, écriture élargie
DROP POLICY IF EXISTS "document_templates_write_admin" ON public.document_templates;
DROP POLICY IF EXISTS "document_templates_write_parametres" ON public.document_templates;

CREATE POLICY "document_templates_write_parametres" ON public.document_templates
  FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'gerer_parametres')
    OR public.has_permission(auth.uid(), 'administration')
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'gerer_parametres')
    OR public.has_permission(auth.uid(), 'administration')
  );

NOTIFY pgrst, 'reload schema';
