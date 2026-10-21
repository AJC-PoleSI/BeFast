-- 082_comptes_non_valides_sans_donnees.sql
-- Un compte qui n'est pas validé (en attente, refusé, supprimé) ne lit et
-- n'écrit AUCUNE donnée métier, même en interrogeant directement l'API
-- Supabase avec son propre jeton.
--
-- Contexte (19/10/2026) : le rejet de comptes était utilisé pour « fermer la
-- porte » à des inscrits, y compris en bloc et sans motif. Remplacé par une
-- règle plus simple : tant qu'un compte n'est pas validé, il ne voit rien.
-- Côté application c'était déjà le cas (resolveEffectivePermissions ramène un
-- compte non validé à `profil` + `documents`), mais aucune policy RLS ne
-- regardait `account_status` : la restriction ne tenait qu'à l'affichage et
-- aux gardes serveur. Cette migration la pose aussi dans la base.
--
-- Mécanisme : une policy RESTRICTIVE par table. Elle s'ajoute (ET) aux
-- policies permissives existantes, qu'on ne touche pas : un compte validé voit
-- exactement ce qu'il voyait avant. Un administrateur passe toujours (comme
-- dans estCompteRestreint). Le service_role contourne la RLS, donc les routes
-- et actions serveur en `createAdminClient()` ne changent pas.
--
-- Tables laissées de côté, car un compte non validé doit y accéder pour
-- compléter son profil et déposer ses justificatifs : personnes,
-- personne_postes, profils_types, documents_personnes, custom_fields,
-- custom_field_values, notifications (les siennes), audit_logs (insert),
-- support_tickets, parametres (déjà réservé aux administrateurs, 080).
--
-- Idempotent : ré-exécuter ne casse rien.

CREATE OR REPLACE FUNCTION public.est_compte_valide(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.personnes p
    LEFT JOIN public.profils_types pt ON pt.id = p.profil_type_id
    WHERE p.id = p_user_id
      AND (p.account_status = 'validated' OR pt.slug = 'administrateur')
  );
$$;

-- Même hygiène que 076 : jamais exécutable par PUBLIC/anon.
REVOKE EXECUTE ON FUNCTION public.est_compte_valide(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.est_compte_valide(uuid) TO authenticated;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'budget_etude', 'candidatures', 'clients', 'document_templates',
    'echeancier_blocs', 'etude_suiveurs', 'etudes', 'facture_lignes',
    'factures', 'generated_documents', 'marges_recommandees',
    'mission_checklist', 'mission_collaborations', 'mission_documents',
    'missions', 'notes_de_frais', 'phases_defaut', 'proposal_phases',
    'proposals', 'retributions', 'signature_requests'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "compte valide requis" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "compte valide requis" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING ((SELECT public.est_compte_valide(auth.uid()))) '
      'WITH CHECK ((SELECT public.est_compte_valide(auth.uid())))',
      t
    );
  END LOOP;
END $$;

-- Test de fumée (à lancer à la main, rôle authenticated simulé) :
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<uuid d'un compte en attente>","role":"authenticated"}', true);
--   select count(*) from missions;   -- 0
--   select count(*) from etudes;     -- 0
