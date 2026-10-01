-- ════════════════════════════════════════════════════════════════
--  À COLLER DANS LE SQL EDITOR SUPABASE (projet Befast) — une seule fois
--  https://supabase.com/dashboard/project/rslztpjwrrjrvajkwcvo/sql/new
--
--  Deux migrations, dans cet ordre. Toutes deux idempotentes.
--    1. 069 — RLS de `parametres` / `document_templates` alignée sur les
--       permissions (Phase 2 des rôles et postes, non appliquée au 02/10).
--    2. 078 — audit de sécurité du 02/10/2026 (policies permissives
--       résiduelles, contraintes de colonnes, triggers de garde).
--
--  Vérification après exécution :
--    select tablename, policyname from pg_policies
--     where tablename in ('budget_etude','signature_requests','candidatures',
--                         'mission_collaborations','notes_de_frais','parametres')
--     order by 1,2;
-- ════════════════════════════════════════════════════════════════

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


-- 078_audit_securite_rls_2026_10.sql
--
-- Audit de sécurité du 2026-10-02 (relecture de `pg_policies` en production
-- + revue du code). Tout est idempotent : rejouable sans effet de bord.
--
-- A. Policies historiques « ouvertes à tout compte authentifié » qui ont
--    survécu aux migrations de cloisonnement (034/035 jamais appliquées,
--    050/051 ont ajouté la policy restrictive SANS supprimer l'ancienne ;
--    les policies étant PERMISSIVES, l'ancienne l'emportait) :
--      1. budget_etude       — USING (true) WITH CHECK (true) : lecture ET
--                              écriture du budget de toutes les études.
--      2. signature_requests — USING (true) : toutes les demandes (noms,
--                              emails, identifiants LiveConsent, événements).
--      3. marges_recommandees — USING (true).
--      4. mission_collaborations — « chef_projet manage » (025) : tout compte
--                              pouvait s'insérer comme collaborateur de
--                              n'importe quelle mission, donc devenir
--                              « intervenant » au sens des helpers RLS
--                              (documents générés, notes de frais, étude).
-- B. Écritures sans contrainte de colonne :
--      5. candidatures insert — `statut` libre : un intervenant s'insérait
--                              une candidature déjà « acceptee » (= affecté,
--                              payé par la trésorerie).
--      6. notes_de_frais update — le déposant pouvait se valider lui-même.
--      7. support_tickets insert — `utilisateur_id` libre : demande de
--                              suppression de compte au nom d'un autre.
--      8. personnes update own — `email` modifiable par son propriétaire ;
--                              combiné au lien « définir mon mot de passe »
--                              (recovery généré sur personnes.email), prise
--                              de contrôle d'un autre compte.
--      9. etudes / missions   — `published`, `created_by`, `intervenant_id`
--                              écrits par le client sans la permission.
-- C. Lecture de `parametres` (RIB, IBAN, n° URSSAF, taux…) par tout compte.
-- D. Policies déclarées « TO public » ramenées à authenticated.

-- ════════════════════════════════════════════════════════════════════════
-- A. Policies permissives résiduelles
-- ════════════════════════════════════════════════════════════════════════

-- 1. budget_etude : reste "budget_etude interne only" (050)
DROP POLICY IF EXISTS "auth all budget_etude" ON public.budget_etude;
DROP POLICY IF EXISTS "auth read budget_etude" ON public.budget_etude;

-- 2. signature_requests : reste "signature_requests interne" (051) + lecture
--    ciblée pour le signataire concerné et les porteurs des clés de signature.
DROP POLICY IF EXISTS "signature_requests_select_authenticated" ON public.signature_requests;
DROP POLICY IF EXISTS "signature_requests_select_concerne" ON public.signature_requests;
CREATE POLICY "signature_requests_select_concerne" ON public.signature_requests
  FOR SELECT TO authenticated
  USING (
    personne_id = auth.uid()
    OR public.has_permission(auth.uid(), 'signer_documents')
    OR public.has_permission(auth.uid(), 'signer_ba')
  );

-- 3. marges_recommandees : restent "marges_recommandees interne only" (050)
--    et "admin write marges" (028)
DROP POLICY IF EXISTS "public read marges" ON public.marges_recommandees;

-- 4. mission_collaborations : reste "mission_collaborations access" (051,
--    interne ou intervenant de la ligne) et "intervenant create" (041,
--    exige missions.intervenant_id = soi).
DROP POLICY IF EXISTS "chef_projet manage mission_collaborations" ON public.mission_collaborations;
DROP POLICY IF EXISTS "collaborators read mission_collaborations" ON public.mission_collaborations;

-- ════════════════════════════════════════════════════════════════════════
-- B. Contraintes de colonnes
-- ════════════════════════════════════════════════════════════════════════

-- 5. candidatures : un compte ne dépose qu'une candidature « en_attente »,
--    sans date de réponse ni auteur. Les affectations directes passent par le
--    client service_role (affecterIntervenant) et ne sont pas concernées.
DROP POLICY IF EXISTS "candidatures insert own" ON public.candidatures;
CREATE POLICY "candidatures insert own" ON public.candidatures
  FOR INSERT TO authenticated
  WITH CHECK (
    personne_id = auth.uid()
    AND statut = 'en_attente'
    AND reponse_date IS NULL
    AND (created_by IS NULL OR created_by = auth.uid())
    AND public.is_compte_actif(auth.uid())
    AND (public.is_membre_interne(auth.uid()) OR public.is_mission_publiee(mission_id))
  );

-- 6. notes_de_frais : le déposant ne touche qu'à une note brouillon/soumise
--    et ne peut pas la valider ; validation/paiement = trésorerie.
DROP POLICY IF EXISTS "notes_de_frais update" ON public.notes_de_frais;
DROP POLICY IF EXISTS "notes_de_frais update own draft" ON public.notes_de_frais;
DROP POLICY IF EXISTS "notes_de_frais update tresorerie" ON public.notes_de_frais;
CREATE POLICY "notes_de_frais update own draft" ON public.notes_de_frais
  FOR UPDATE TO authenticated
  USING (intervenant_id = auth.uid() AND statut IN ('brouillon', 'soumis'))
  WITH CHECK (intervenant_id = auth.uid() AND statut IN ('brouillon', 'soumis') AND validated_at IS NULL);
CREATE POLICY "notes_de_frais update tresorerie" ON public.notes_de_frais
  FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'voir_factures'))
  WITH CHECK (public.has_permission(auth.uid(), 'voir_factures'));

-- 7. support_tickets : un ticket est le sien (ou anonyme), jamais celui d'un autre.
DROP POLICY IF EXISTS "authenticated insert support_tickets" ON public.support_tickets;
CREATE POLICY "authenticated insert support_tickets" ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (utilisateur_id IS NULL OR utilisateur_id = auth.uid());

-- 8. personnes : le trigger (050) ne protégeait que rôle, statut, is_candidate
--    et reset_token_hash. On y ajoute l'identité du compte et les colonnes
--    techniques. Toutes les écritures légitimes de ces colonnes passent par
--    le client service_role (routes et actions serveur), non concerné.
CREATE OR REPLACE FUNCTION public.guard_personnes_colonnes_sensibles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Le service role (jwt role absent ou 'service_role') n'est pas concerné :
  -- c'est lui qui porte les opérations d'administration légitimes.
  IF coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'role'
     IS DISTINCT FROM 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF NEW.profil_type_id IS DISTINCT FROM OLD.profil_type_id
     OR NEW.account_status IS DISTINCT FROM OLD.account_status
     OR NEW.is_candidate  IS DISTINCT FROM OLD.is_candidate
     OR NEW.reset_token_hash IS DISTINCT FROM OLD.reset_token_hash
     OR NEW.reset_token_expires_at IS DISTINCT FROM OLD.reset_token_expires_at
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.email_verified IS DISTINCT FROM OLD.email_verified
     OR NEW.verification_token_hash IS DISTINCT FROM OLD.verification_token_hash
     OR NEW.verification_token_expires_at IS DISTINCT FROM OLD.verification_token_expires_at
     OR NEW.encryption_salt IS DISTINCT FROM OLD.encryption_salt
     OR NEW.legacy_bequick_id IS DISTINCT FROM OLD.legacy_bequick_id
     OR NEW.rh_candidate_id IS DISTINCT FROM OLD.rh_candidate_id
     OR NEW.password_set_at IS DISTINCT FROM OLD.password_set_at
     OR NEW.password_setup_sent_at IS DISTINCT FROM OLD.password_setup_sent_at
     OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
     OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at
     OR NEW.rejected_by IS DISTINCT FROM OLD.rejected_by THEN
    RAISE EXCEPTION 'Modification non autorisée : identité, rôle, statut de compte ou jeton';
  END IF;

  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_personnes_colonnes_sensibles() FROM PUBLIC, anon, authenticated;

-- Une adresse = un compte (aucun doublon constaté le 2026-10-02).
CREATE UNIQUE INDEX IF NOT EXISTS personnes_email_lower_key
  ON public.personnes (lower(email)) WHERE email IS NOT NULL;

-- 9. etudes / missions : publication, créateur et intervenant principal ne
--    s'écrivent qu'avec la permission correspondante (les actions serveur
--    `toggleEtudePublished` / `toggleMissionPublished` la vérifient déjà ;
--    ici on ferme l'accès direct à PostgREST). Le service role passe.
CREATE OR REPLACE FUNCTION public.guard_etudes_missions_colonnes_sensibles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'role'
     IS DISTINCT FROM 'authenticated' THEN
    RETURN NEW;
  END IF;
  IF public.is_admin(v_uid) THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'etudes' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.created_by IS DISTINCT FROM v_uid THEN
        RAISE EXCEPTION 'created_by doit être le compte courant';
      END IF;
      IF coalesce(NEW.published, false) AND NOT public.has_permission(v_uid, 'publier_etudes') THEN
        RAISE EXCEPTION 'Publier une étude exige la permission publier_etudes';
      END IF;
    ELSE
      IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
        RAISE EXCEPTION 'created_by n''est pas modifiable';
      END IF;
      IF NEW.published IS DISTINCT FROM OLD.published AND NOT public.has_permission(v_uid, 'publier_etudes') THEN
        RAISE EXCEPTION 'Publier une étude exige la permission publier_etudes';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'missions' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.created_by IS NOT NULL AND NEW.created_by IS DISTINCT FROM v_uid THEN
        RAISE EXCEPTION 'created_by doit être le compte courant';
      END IF;
      IF coalesce(NEW.published, false) AND NOT public.has_permission(v_uid, 'publier_missions') THEN
        RAISE EXCEPTION 'Publier une mission exige la permission publier_missions';
      END IF;
      IF NEW.intervenant_id IS NOT NULL
         AND NOT (public.has_permission(v_uid, 'assigner_intervenants') OR public.has_permission(v_uid, 'selectionner_candidats')) THEN
        RAISE EXCEPTION 'Affecter un intervenant exige assigner_intervenants ou selectionner_candidats';
      END IF;
    ELSE
      IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
        RAISE EXCEPTION 'created_by n''est pas modifiable';
      END IF;
      IF NEW.published IS DISTINCT FROM OLD.published AND NOT public.has_permission(v_uid, 'publier_missions') THEN
        RAISE EXCEPTION 'Publier une mission exige la permission publier_missions';
      END IF;
      IF NEW.intervenant_id IS DISTINCT FROM OLD.intervenant_id
         AND NOT (public.has_permission(v_uid, 'assigner_intervenants') OR public.has_permission(v_uid, 'selectionner_candidats')) THEN
        RAISE EXCEPTION 'Affecter un intervenant exige assigner_intervenants ou selectionner_candidats';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_etudes_missions_colonnes_sensibles() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_etudes_colonnes_sensibles ON public.etudes;
CREATE TRIGGER trg_guard_etudes_colonnes_sensibles
  BEFORE INSERT OR UPDATE ON public.etudes
  FOR EACH ROW EXECUTE FUNCTION public.guard_etudes_missions_colonnes_sensibles();

DROP TRIGGER IF EXISTS trg_guard_missions_colonnes_sensibles ON public.missions;
CREATE TRIGGER trg_guard_missions_colonnes_sensibles
  BEFORE INSERT OR UPDATE ON public.missions
  FOR EACH ROW EXECUTE FUNCTION public.guard_etudes_missions_colonnes_sensibles();

-- Échéancier : mêmes ayants droit que les missions (070) — créateur,
-- suiveurs, modifier_etudes, admin — au lieu de « tout membre interne ».
DROP POLICY IF EXISTS "echeancier_blocs write" ON public.echeancier_blocs;
CREATE POLICY "echeancier_blocs write" ON public.echeancier_blocs
  FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'modifier_etudes')
    OR public.est_suiveur_etude(etude_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.etudes e WHERE e.id = echeancier_blocs.etude_id AND e.created_by = auth.uid())
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'modifier_etudes')
    OR public.est_suiveur_etude(etude_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.etudes e WHERE e.id = echeancier_blocs.etude_id AND e.created_by = auth.uid())
  );

-- ════════════════════════════════════════════════════════════════════════
-- C. parametres : lecture réservée aux membres internes, aux porteurs de
--    parametres_structure / voir_factures, et à quelques clés d'affichage
--    (liste des pôles sur le profil, taux de TVA). Les routes et actions qui
--    ont besoin du reste lisent avec le client service_role derrière leur
--    garde applicatif.
-- ════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "public read parametres" ON public.parametres;
DROP POLICY IF EXISTS "parametres read" ON public.parametres;
CREATE POLICY "parametres read" ON public.parametres
  FOR SELECT TO authenticated
  USING (
    public.is_membre_interne(auth.uid())
    OR public.has_permission(auth.uid(), 'parametres_structure')
    OR public.has_permission(auth.uid(), 'voir_factures')
    OR key = ANY (ARRAY['poles_liste', 'tva_rate', 'tva_taux'])
  );

-- ════════════════════════════════════════════════════════════════════════
-- D. Policies « TO public » (donc aussi anon) ramenées à authenticated.
--    Avec auth.uid() NULL elles ne renvoyaient rien, sauf custom_fields_read
--    (USING true) qui exposait la liste des champs personnalisés sans
--    connexion.
-- ════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "custom_fields_read" ON public.custom_fields;
-- "custom_fields read" (TO authenticated, USING true) reste en place.

DROP POLICY IF EXISTS "personne_postes_select" ON public.personne_postes;
-- "personne_postes read" (TO authenticated, soi-même ou membre interne) reste.

DROP POLICY IF EXISTS "custom_field_values_read_own"   ON public.custom_field_values;
DROP POLICY IF EXISTS "custom_field_values_insert_own" ON public.custom_field_values;
DROP POLICY IF EXISTS "custom_field_values_update_own" ON public.custom_field_values;
DROP POLICY IF EXISTS "custom_field_values_delete_own" ON public.custom_field_values;
CREATE POLICY "custom_field_values_read_own" ON public.custom_field_values
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "custom_field_values_insert_own" ON public.custom_field_values
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "custom_field_values_update_own" ON public.custom_field_values
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "custom_field_values_delete_own" ON public.custom_field_values
  FOR DELETE TO authenticated USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
