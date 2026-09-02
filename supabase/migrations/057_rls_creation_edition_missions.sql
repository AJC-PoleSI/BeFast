-- 057_rls_creation_edition_missions.sql
-- Créer/modifier une mission sur une étude : réservé au créateur de
-- l'étude, au Pôle SI et aux administrateurs — même règle que la
-- modification de l'étude elle-même (modifier_etudes / canEditEtude).
--
-- Avant cette migration, "missions write" (migration 050, FOR ALL) laissait
-- n'importe quel membre interne (is_membre_interne : admin, membre_ajc,
-- chef_de_projet) créer ou modifier une mission sur n'importe quelle étude,
-- y compris une étude créée par quelqu'un d'autre. Le bouton "Créer une
-- mission" de la page étude n'était lui-même pas filtré.
--
-- Exceptions pour ne pas casser des parcours existants qui écrivent sur
-- `missions` sans passer par la création/l'édition métier :
--   - publier_missions (Marketing/SI) : bascule le flag `published` d'une
--     mission (toggleMissionPublished).
--   - voir_factures (Trésorerie) : enregistre la date de paiement / le
--     numéro de BV d'une mission (marquerMissionPaiement) — sur UPDATE
--     uniquement, aucun besoin en INSERT/DELETE.

DROP POLICY IF EXISTS "missions write" ON public.missions;

CREATE POLICY "missions insert" ON public.missions FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'modifier_etudes')
    OR EXISTS (SELECT 1 FROM public.etudes e WHERE e.id = etude_id AND e.created_by = auth.uid())
  );

CREATE POLICY "missions update" ON public.missions FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'modifier_etudes')
    OR public.has_permission(auth.uid(), 'publier_missions')
    OR public.has_permission(auth.uid(), 'voir_factures')
    OR EXISTS (SELECT 1 FROM public.etudes e WHERE e.id = etude_id AND e.created_by = auth.uid())
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'modifier_etudes')
    OR public.has_permission(auth.uid(), 'publier_missions')
    OR public.has_permission(auth.uid(), 'voir_factures')
    OR EXISTS (SELECT 1 FROM public.etudes e WHERE e.id = etude_id AND e.created_by = auth.uid())
  );

CREATE POLICY "missions delete" ON public.missions FOR DELETE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'modifier_etudes')
    OR EXISTS (SELECT 1 FROM public.etudes e WHERE e.id = etude_id AND e.created_by = auth.uid())
  );

NOTIFY pgrst, 'reload schema';
