-- 077_candidat_lit_ses_missions.sql
-- Un intervenant lit les missions auxquelles il a candidaté (ou été affecté)
-- et les études où il est retenu, même quand elles ne sont pas publiées.
--
-- Symptôme (28/09/2026) : sur l'accueil d'un intervenant, le bloc « Statut
-- candidatures » affichait une ligne sans libellé. La jointure
-- candidatures → missions renvoyait null parce que "missions read" ne laissait
-- lire à un non-membre que les missions publiées (074) ou celles dont il est
-- `missions.intervenant_id` / `mission_collaborations` — or l'affectation
-- d'un intervenant passe par une candidature acceptée, et `intervenant_id`
-- n'est écrit par aucun chemin de code. Cas réel : affectation directe au
-- « Suivi de l'étude » (mission SDP, jamais publiée) de l'étude 2620.
-- Conséquence au-delà du libellé : la mission disparaissait aussi du calcul
-- « Mes rétributions » et « Mes missions en cours ».
--
-- Règle :
-- - missions : lisible par toute personne qui a une candidature dessus, quel
--   qu'en soit le statut (elle l'a vue publiée en candidatant, ou on l'y a
--   affectée) ;
-- - études : lisible seulement si la candidature est ACCEPTÉE — une ligne
--   `etudes` porte des données commerciales (budget, marge, client), un
--   candidat en attente ou refusé n'a pas à les lire.
-- Les clauses existantes sont reprises telles qu'en prod au 28/09/2026 (dont
-- `voir_factures`, ajoutée par la 067) : on n'ajoute qu'un OR.
--
-- Côté application rien ne s'ouvre en plus : la fiche mission garde son propre
-- filtre (mission publiée, hors SDP) et getMissions() filtre sur
-- estMissionPubliee ; /etudes reste fermé aux intervenants (clé `etudes`).
--
-- SECURITY DEFINER (comme is_mission_intervenant / intervient_sur_etude) :
-- la policy "etudes read" ne peut pas relire `missions` sous RLS sans boucler
-- ("missions read" relit `etudes`). search_path figé et EXECUTE retiré à
-- PUBLIC/anon, cf. 076.
--
-- Idempotent : ré-exécuter ne casse rien.

CREATE OR REPLACE FUNCTION public.a_candidate_sur_mission(p_mission_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.candidatures c
    WHERE c.mission_id = p_mission_id AND c.personne_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.est_retenu_sur_etude(p_etude_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.candidatures c
    JOIN public.missions m ON m.id = c.mission_id
    WHERE m.etude_id = p_etude_id
      AND c.personne_id = p_user_id
      AND c.statut = 'acceptee'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.a_candidate_sur_mission(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.est_retenu_sur_etude(uuid, uuid)   FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.a_candidate_sur_mission(uuid, uuid),
  public.est_retenu_sur_etude(uuid, uuid)
TO authenticated, service_role;

DROP POLICY IF EXISTS "missions read" ON public.missions;

CREATE POLICY "missions read" ON public.missions FOR SELECT TO authenticated
  USING (
    public.is_membre_interne(auth.uid())
    OR public.is_mission_intervenant(id, auth.uid())
    OR public.a_candidate_sur_mission(id, auth.uid())
    OR (
      published = true
      AND EXISTS (
        SELECT 1 FROM public.etudes e
        WHERE e.id = missions.etude_id AND e.published = true
      )
    )
    OR public.has_permission(auth.uid(), 'voir_factures')
  );

DROP POLICY IF EXISTS "etudes read" ON public.etudes;

CREATE POLICY "etudes read" ON public.etudes FOR SELECT TO authenticated
  USING (
    public.is_membre_interne(auth.uid())
    OR public.intervient_sur_etude(id, auth.uid())
    OR public.est_retenu_sur_etude(id, auth.uid())
    OR published = true
  );

NOTIFY pgrst, 'reload schema';
