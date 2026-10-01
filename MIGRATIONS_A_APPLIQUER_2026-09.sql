-- ════════════════════════════════════════════════════════════════
--  À COLLER DANS LE SQL EDITOR SUPABASE (projet Befast) — une seule fois
--  https://supabase.com/dashboard/project/rslztpjwrrjrvajkwcvo/sql/new
--
--  Cartographie des rôles du 12/09/2026 : la RLS de `parametres` et de
--  `document_templates` restait verrouillée sur le seul rôle de base
--  « administrateur », alors que l'application ouvre désormais ces écrans aux
--  postes porteurs de `parametres_structure` (Présidente, Pôle Trésorerie) et
--  de `gerer_parametres`. Sans ce bloc, ces profils passent le garde applicatif
--  puis sont refusés par Postgres.
--
--  Idempotent (DROP POLICY IF EXISTS) : ré-exécuter ne casse rien.
--
--  ⚠ Rappel : 067_retributions_intervenants.sql n'est TOUJOURS pas appliquée
--    (la table `retributions` est absente de la base). Elle est indépendante
--    de ce bloc, mais l'export trésorerie l'interroge.
-- ════════════════════════════════════════════════════════════════

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


-- ════════════════════════════════════════════════════════════════
--  AJOUT DU 21/09/2026 — migration 070_suiveurs_gerent_leur_etude.sql
--  Le chef de projet (suiveur) d'une étude ne pouvait créer aucune
--  mission dessus : la migration 057 ne connaissait que le créateur de
--  l'étude et `modifier_etudes` (3 comptes en tout).
--  Idempotent : ré-exécuter ne casse rien.
-- ════════════════════════════════════════════════════════════════

-- 070_suiveurs_gerent_leur_etude.sql
-- Le chef de projet (suiveur) d'une étude doit pouvoir gérer cette étude.
--
-- La migration 057 a réservé l'écriture des missions au créateur de l'étude,
-- aux porteurs de `modifier_etudes` et aux administrateurs. Elle a oublié les
-- suiveurs : une personne désignée chef de projet sur une étude qu'elle n'a
-- pas créée ne pouvait créer aucune mission dessus. Comme seuls les comptes
-- « administrateur » portent effectivement `modifier_etudes` en base, toute la
-- staffing des études remontait à trois personnes.
--
-- 1. `missions` insert/update/delete acceptent désormais les suiveurs.
-- 2. Rattrapage des études existantes : le créateur devient suiveur de son
--    étude (c'était déjà le cas pour la plupart ; l'insert est idempotent).
--
-- La suppression d'une ÉTUDE (migration 056) reste volontairement fermée aux
-- suiveurs — pendant applicatif : `canDeleteEtude` dans lib/auth/permissions.ts.

-- Helper SECURITY DEFINER : évite que la policy sur `missions` dépende de la
-- RLS de `etude_suiveurs` (même motif que is_membre_interne / has_permission).
CREATE OR REPLACE FUNCTION public.est_suiveur_etude(p_etude_id uuid, p_user_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.etude_suiveurs es
    WHERE es.etude_id = p_etude_id
      AND es.personne_id = p_user_id
  );
$function$;

DROP POLICY IF EXISTS "missions insert" ON public.missions;

CREATE POLICY "missions insert" ON public.missions FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'modifier_etudes')
    OR public.est_suiveur_etude(etude_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.etudes e WHERE e.id = etude_id AND e.created_by = auth.uid())
  );

DROP POLICY IF EXISTS "missions update" ON public.missions;

CREATE POLICY "missions update" ON public.missions FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'modifier_etudes')
    OR public.has_permission(auth.uid(), 'publier_missions')
    OR public.has_permission(auth.uid(), 'voir_factures')
    OR public.est_suiveur_etude(etude_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.etudes e WHERE e.id = etude_id AND e.created_by = auth.uid())
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'modifier_etudes')
    OR public.has_permission(auth.uid(), 'publier_missions')
    OR public.has_permission(auth.uid(), 'voir_factures')
    OR public.est_suiveur_etude(etude_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.etudes e WHERE e.id = etude_id AND e.created_by = auth.uid())
  );

DROP POLICY IF EXISTS "missions delete" ON public.missions;

CREATE POLICY "missions delete" ON public.missions FOR DELETE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'modifier_etudes')
    OR public.est_suiveur_etude(etude_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.etudes e WHERE e.id = etude_id AND e.created_by = auth.uid())
  );

-- Rattrapage : le créateur de chaque étude est suiveur de son étude.
INSERT INTO public.etude_suiveurs (etude_id, personne_id)
SELECT e.id, e.created_by
FROM public.etudes e
WHERE e.created_by IS NOT NULL
ON CONFLICT (etude_id, personne_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
