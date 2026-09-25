-- 074_publication_mission_par_mission.sql
-- Publication mission par mission : dans une étude publiée, on veut pouvoir
-- ouvrir une mission aux candidatures et en garder une autre cachée pour plus
-- tard. L'œil de l'étude ouvre l'étude, celui de chaque mission (page étude,
-- droit `publier_missions`) ouvre la mission.
--
-- Règle : une mission est ouverte aux intervenants si elle est publiée ET que
-- son étude l'est. Avant, "missions read" (053) disait `published = true OR
-- étude publiée` : publier l'étude ouvrait toutes ses missions d'un coup, et
-- missions.published n'était jamais utilisé.
--
-- Même règle côté application : lib/mission-visibilite.ts (estMissionPubliee),
-- utilisée par getMissions() et la fiche mission.
--
-- Candidatures : jusqu'ici "candidatures insert own" n'exigeait que le compte
-- actif ; un intervenant pouvait candidater à une mission cachée via l'API. On
-- exige désormais une mission ouverte, sauf pour les membres internes (qui
-- voient déjà toutes les missions, SDP comprises).
--
-- État prod vérifié le 25/09/2026 : 0 étude publiée sur 6, 0 mission publiée
-- sur 13 — le changement de règle ne cache rien de ce qui était visible.
-- Les missions créées ensuite naissent cachées (DEFAULT false, migration 015).
--
-- ⚠ 067_retributions_intervenants.sql (non appliquée à cette date) recrée
-- "missions read" : sa définition a été alignée sur cette règle, pour ne pas
-- la défaire quand elle sera appliquée.
--
-- Idempotent : ré-exécuter ne casse rien.

-- Mission ouverte : publiée, sous une étude publiée. SECURITY DEFINER pour ne
-- pas dépendre de la RLS de missions/etudes quand on l'appelle depuis la
-- policy de candidatures.
CREATE OR REPLACE FUNCTION public.is_mission_publiee(p_mission_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.missions m
    JOIN public.etudes e ON e.id = m.etude_id
    WHERE m.id = p_mission_id
      AND m.published = true
      AND e.published = true
  );
$$;

DROP POLICY IF EXISTS "missions read" ON public.missions;

CREATE POLICY "missions read" ON public.missions FOR SELECT TO authenticated
  USING (
    public.is_membre_interne(auth.uid())
    OR public.is_mission_intervenant(id, auth.uid())
    OR (
      published = true
      AND EXISTS (
        SELECT 1 FROM public.etudes e
        WHERE e.id = missions.etude_id AND e.published = true
      )
    )
  );

DROP POLICY IF EXISTS "candidatures insert own" ON public.candidatures;

CREATE POLICY "candidatures insert own" ON public.candidatures FOR INSERT TO authenticated
  WITH CHECK (
    personne_id = auth.uid()
    AND public.is_compte_actif(auth.uid())
    AND (
      public.is_membre_interne(auth.uid())
      OR public.is_mission_publiee(mission_id)
    )
  );

NOTIFY pgrst, 'reload schema';
