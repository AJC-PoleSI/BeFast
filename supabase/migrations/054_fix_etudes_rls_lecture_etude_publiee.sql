-- 054_fix_etudes_rls_lecture_etude_publiee.sql
-- Complète le correctif de la migration 053 : "missions read" autorise
-- désormais la lecture d'une mission dont l'étude est publiée, mais
-- getMissions() (et d'autres écrans) lisent published via une jointure
-- `missions(..., etudes(id, nom, numero, published))`. Cette jointure est
-- elle-même soumise à la policy "etudes read" (migration 050), qui ne
-- laisse lire une étude qu'aux membres internes ou à ceux qui interviennent
-- déjà dessus — sans exception pour les études publiées.
--
-- Conséquence : pour un intervenant qui n'a encore aucune mission sur
-- l'étude (le cas exact d'un candidat qui parcourt les missions
-- disponibles), la jointure renvoie etudes = null, et le filtre
-- `etudes?.published === true` élimine la mission malgré une étude
-- publiée. D'où le problème signalé toujours présent après la 053.

DROP POLICY IF EXISTS "etudes read" ON public.etudes;

CREATE POLICY "etudes read" ON public.etudes FOR SELECT TO authenticated
  USING (
    public.is_membre_interne(auth.uid())
    OR public.intervient_sur_etude(id, auth.uid())
    OR published = true
  );

NOTIFY pgrst, 'reload schema';
