-- 056_rls_suppression_etudes.sql
-- Suppression d'une étude : réservée au créateur, au Pôle SI et aux
-- administrateurs — même règle que la modification (modifier_etudes,
-- migration 052 / canEditEtude côté code). Avant cette migration, la policy
-- "etudes delete" (migration 050) réservait la suppression aux seuls
-- administrateurs ; l'UI affichait pourtant le bouton à tout le monde et
-- retirait l'étude de la liste même quand la RLS bloquait silencieusement
-- la requête (DELETE sans .select() : aucune erreur remontée).

DROP POLICY IF EXISTS "etudes delete" ON public.etudes;
DROP POLICY IF EXISTS "admin delete etudes" ON public.etudes;

CREATE POLICY "etudes delete" ON public.etudes FOR DELETE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR created_by = auth.uid()
    OR public.has_permission(auth.uid(), 'modifier_etudes')
  );

NOTIFY pgrst, 'reload schema';
