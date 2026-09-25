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
