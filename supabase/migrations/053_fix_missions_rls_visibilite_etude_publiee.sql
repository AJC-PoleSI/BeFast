-- 053_fix_missions_rls_visibilite_etude_publiee.sql
-- Corrige un bug de la policy "missions read" (migration 050) : elle
-- vérifiait missions.published, une colonne jamais mise à true nulle part
-- dans le code applicatif. La logique réelle (getMissions(), dashboard
-- membre) se base sur etudes.published : une mission est visible aux
-- intervenants dès que l'étude qui la porte est publiée. Résultat avant
-- correctif : un intervenant ne voyait JAMAIS aucune mission disponible,
-- même sous une étude publiée.
--
-- On garde `missions.published = true` en plus (OR), au cas où une
-- publication mission par mission serait utilisée plus tard.

DROP POLICY IF EXISTS "missions read" ON public.missions;

CREATE POLICY "missions read" ON public.missions FOR SELECT TO authenticated
  USING (
    public.is_membre_interne(auth.uid())
    OR public.is_mission_intervenant(id, auth.uid())
    OR published = true
    OR EXISTS (
      SELECT 1 FROM public.etudes e
      WHERE e.id = missions.etude_id AND e.published = true
    )
  );

NOTIFY pgrst, 'reload schema';
