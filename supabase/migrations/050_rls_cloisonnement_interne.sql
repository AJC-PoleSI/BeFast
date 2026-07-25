-- Migration 050: cloisonnement interne (remplace l'intention des migrations
-- 023 et 035, qui n'ont jamais pu s'appliquer — voir le commentaire de 049).
--
-- MODÈLE D'ACCÈS (validé avec Felix, 25/07/2026) :
--   « Les membres AJC créent les études et les missions ; les intervenants
--     postulent pour ces missions et les réalisent. »
--
--   - interne  = administrateur | membre_ajc | chef_de_projet, compte validé
--                → accès complet au métier (études, clients, finances)
--   - intervenant = réalise des missions
--                → voit les missions publiées (pour postuler), SES missions,
--                  SES candidatures, SES notes de frais, SA fiche
--                → ne voit NI les études, NI les clients, NI les factures,
--                  NI les budgets, NI l'annuaire des membres
--   - candidat / ancien_membre_agc / compte non validé → aucun accès métier
--
-- ⚠️ IMPACT : 599 comptes ont aujourd'hui le rôle `intervenant` et voient
-- actuellement TOUT. Cette migration restreint réellement leur périmètre.
-- À TESTER avec un compte intervenant avant de considérer le sujet clos.
-- Un script d'annulation figure en fin de fichier.

-- ============================================================
-- 1. HELPERS (SECURITY DEFINER : lisent personnes hors RLS,
--    sinon récursion infinie dans les policies)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.personnes p
    JOIN public.profils_types pt ON pt.id = p.profil_type_id
    WHERE p.id = p_user_id AND pt.slug = 'administrateur'
  );
$$;

-- Membre interne AJC : crée/gère les études et les missions.
CREATE OR REPLACE FUNCTION public.is_membre_interne(p_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.personnes p
    JOIN public.profils_types pt ON pt.id = p.profil_type_id
    WHERE p.id = p_user_id
      AND p.account_status = 'validated'
      AND pt.slug IN ('administrateur', 'membre_ajc', 'chef_de_projet')
  );
$$;

-- Intervenant sur une mission : colonne missions.intervenant_id (intervenant
-- principal) ou table mission_collaborations (intervenants additionnels).
-- Il n'existe PAS de table mission_intervenants dans ce schéma.
CREATE OR REPLACE FUNCTION public.is_mission_intervenant(p_mission_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.missions m
    WHERE m.id = p_mission_id AND m.intervenant_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.mission_collaborations mc
    WHERE mc.mission_id = p_mission_id AND mc.intervenant_id = p_user_id
  );
$$;

-- Intervenant sur au moins une mission de l'étude (donne un accès en lecture
-- au strict contexte de l'étude, pas à ses données financières).
CREATE OR REPLACE FUNCTION public.intervient_sur_etude(p_etude_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.missions m
    WHERE m.etude_id = p_etude_id
      AND (
        m.intervenant_id = p_user_id
        OR EXISTS (
          SELECT 1 FROM public.mission_collaborations mc
          WHERE mc.mission_id = m.id AND mc.intervenant_id = p_user_id
        )
      )
  );
$$;

-- Purge générique des policies d'une table (noms hétérogènes selon l'historique)
CREATE OR REPLACE FUNCTION public.__drop_all_policies(p_table text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'public' AND tablename = p_table
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, p_table);
  END LOOP;
END $$;

-- ============================================================
-- 2. MÉTIER RÉSERVÉ AUX MEMBRES INTERNES
-- ============================================================

-- ── etudes : lecture interne + intervenant du projet ; écriture interne
SELECT public.__drop_all_policies('etudes');
ALTER TABLE public.etudes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "etudes read" ON public.etudes FOR SELECT TO authenticated
  USING (public.is_membre_interne(auth.uid()) OR public.intervient_sur_etude(id, auth.uid()));
CREATE POLICY "etudes insert" ON public.etudes FOR INSERT TO authenticated
  WITH CHECK (public.is_membre_interne(auth.uid()));
CREATE POLICY "etudes update" ON public.etudes FOR UPDATE TO authenticated
  USING (public.is_membre_interne(auth.uid()))
  WITH CHECK (public.is_membre_interne(auth.uid()));
CREATE POLICY "etudes delete" ON public.etudes FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- ── etude_suiveurs (créée par 048)
SELECT public.__drop_all_policies('etude_suiveurs');
ALTER TABLE public.etude_suiveurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "etude_suiveurs read" ON public.etude_suiveurs FOR SELECT TO authenticated
  USING (public.is_membre_interne(auth.uid()));
CREATE POLICY "etude_suiveurs write" ON public.etude_suiveurs FOR ALL TO authenticated
  USING (public.is_membre_interne(auth.uid()))
  WITH CHECK (public.is_membre_interne(auth.uid()));

-- ── clients : données commerciales, strictement internes
SELECT public.__drop_all_policies('clients');
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients read" ON public.clients FOR SELECT TO authenticated
  USING (public.is_membre_interne(auth.uid()));
CREATE POLICY "clients write" ON public.clients FOR ALL TO authenticated
  USING (public.is_membre_interne(auth.uid()))
  WITH CHECK (public.is_membre_interne(auth.uid()));

-- ── missions : les intervenants voient les missions publiées (pour postuler)
--    et celles qu'ils réalisent ; seuls les internes créent/modifient.
SELECT public.__drop_all_policies('missions');
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "missions read" ON public.missions FOR SELECT TO authenticated
  USING (
    public.is_membre_interne(auth.uid())
    OR public.is_mission_intervenant(id, auth.uid())
    OR published = true
  );
CREATE POLICY "missions write" ON public.missions FOR ALL TO authenticated
  USING (public.is_membre_interne(auth.uid()))
  WITH CHECK (public.is_membre_interne(auth.uid()));

-- ── echeancier_blocs : planning de l'étude
SELECT public.__drop_all_policies('echeancier_blocs');
ALTER TABLE public.echeancier_blocs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "echeancier_blocs read" ON public.echeancier_blocs FOR SELECT TO authenticated
  USING (public.is_membre_interne(auth.uid()) OR public.intervient_sur_etude(etude_id, auth.uid()));
CREATE POLICY "echeancier_blocs write" ON public.echeancier_blocs FOR ALL TO authenticated
  USING (public.is_membre_interne(auth.uid()))
  WITH CHECK (public.is_membre_interne(auth.uid()));

-- ── Données financières : internes uniquement, aucune exception
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['factures', 'facture_lignes', 'budget_etude',
                           'proposals', 'proposal_phases', 'marges_recommandees']
  LOOP
    PERFORM public.__drop_all_policies(t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING (public.is_membre_interne(auth.uid()))
         WITH CHECK (public.is_membre_interne(auth.uid()))',
      t || ' interne only', t);
  END LOOP;
END $$;

-- ============================================================
-- 3. DONNÉES PERSONNELLES DE L'INTERVENANT
-- ============================================================

-- ── candidatures : l'intervenant gère les siennes, l'interne les traite
SELECT public.__drop_all_policies('candidatures');
ALTER TABLE public.candidatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "candidatures read" ON public.candidatures FOR SELECT TO authenticated
  USING (personne_id = auth.uid() OR public.is_membre_interne(auth.uid()));
CREATE POLICY "candidatures insert own" ON public.candidatures FOR INSERT TO authenticated
  WITH CHECK (personne_id = auth.uid());
CREATE POLICY "candidatures update" ON public.candidatures FOR UPDATE TO authenticated
  USING (personne_id = auth.uid() OR public.is_membre_interne(auth.uid()))
  WITH CHECK (personne_id = auth.uid() OR public.is_membre_interne(auth.uid()));

-- ── notes de frais : l'intervenant dépose les siennes, l'interne valide
SELECT public.__drop_all_policies('notes_de_frais');
ALTER TABLE public.notes_de_frais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes_de_frais read" ON public.notes_de_frais FOR SELECT TO authenticated
  USING (intervenant_id = auth.uid() OR public.is_membre_interne(auth.uid()));
CREATE POLICY "notes_de_frais insert own" ON public.notes_de_frais FOR INSERT TO authenticated
  WITH CHECK (intervenant_id = auth.uid());
CREATE POLICY "notes_de_frais update" ON public.notes_de_frais FOR UPDATE TO authenticated
  USING (intervenant_id = auth.uid() OR public.is_membre_interne(auth.uid()))
  WITH CHECK (intervenant_id = auth.uid() OR public.is_membre_interne(auth.uid()));

-- ============================================================
-- 4. personnes : fin de l'annuaire ouvert à tous
-- ============================================================
-- 049 avait fermé l'accès ANONYME (faille critique). Ici on ferme l'accès
-- LATÉRAL : un intervenant n'a pas à lire les email/adresse/NSS des 656 autres.
-- Rappel : toutes les écritures applicatives passent par le service role,
-- d'où l'absence volontaire de policy INSERT/DELETE.

SELECT public.__drop_all_policies('personnes');
ALTER TABLE public.personnes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "personnes read" ON public.personnes FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_membre_interne(auth.uid()));

-- Modification de sa propre fiche uniquement. Les colonnes sensibles
-- (profil_type_id, account_status) sont verrouillées par le trigger ci-dessous :
-- sans lui, un utilisateur pourrait se promouvoir administrateur.
CREATE POLICY "personnes update own" ON public.personnes FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.guard_personnes_colonnes_sensibles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
     OR NEW.reset_token_hash IS DISTINCT FROM OLD.reset_token_hash THEN
    RAISE EXCEPTION 'Modification non autorisée : rôle, statut de compte ou jeton';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_personnes_colonnes_sensibles ON public.personnes;
CREATE TRIGGER trg_guard_personnes_colonnes_sensibles
  BEFORE UPDATE ON public.personnes
  FOR EACH ROW EXECUTE FUNCTION public.guard_personnes_colonnes_sensibles();

-- ── profils_types / personne_postes : lecture authentifiée, écriture service role
SELECT public.__drop_all_policies('profils_types');
ALTER TABLE public.profils_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profils_types read" ON public.profils_types FOR SELECT TO authenticated USING (true);

SELECT public.__drop_all_policies('personne_postes');
ALTER TABLE public.personne_postes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "personne_postes read" ON public.personne_postes FOR SELECT TO authenticated
  USING (personne_id = auth.uid() OR public.is_membre_interne(auth.uid()));

DROP FUNCTION IF EXISTS public.__drop_all_policies(text);

NOTIFY pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════
-- ANNULATION (à n'exécuter que si des membres se retrouvent bloqués)
-- Rétablit l'accès permissif d'avant la migration, sans rouvrir l'anonyme :
--
--   DROP TRIGGER IF EXISTS trg_guard_personnes_colonnes_sensibles ON public.personnes;
--   DO $$ DECLARE t text; r record; BEGIN
--     FOREACH t IN ARRAY ARRAY['etudes','clients','missions','echeancier_blocs',
--       'factures','facture_lignes','budget_etude','proposals','proposal_phases',
--       'marges_recommandees','candidatures','notes_de_frais','personnes',
--       'etude_suiveurs','personne_postes'] LOOP
--       FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
--         EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, t);
--       END LOOP;
--       EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t||' auth all', t);
--     END LOOP;
--   END $$;
--   NOTIFY pgrst, 'reload schema';
-- ════════════════════════════════════════════════════════════
