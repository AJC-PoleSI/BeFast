-- ════════════════════════════════════════════════════════════════
--  BLOC À COLLER DANS LE SQL EDITOR SUPABASE (à exécuter une seule fois)
--  Concatène, dans l'ordre, les migrations en attente :
--    1) 027_rejet_budget_parametres.sql   (rejet profils + validation budget + paramètres)
--    2) 027_add_marge_frais_dossier.sql   (marge JE + frais de dossier sur proposals)
--    3) 028_marges_recommandees.sql        (marges recommandées par taille d'entreprise)
--  Toutes les opérations sont idempotentes (IF NOT EXISTS / ON CONFLICT) :
--  ré-exécuter ce bloc ne casse rien.
-- ════════════════════════════════════════════════════════════════


-- ╔══════════════════════════════════════════════════════════════╗
-- ║ 1/3 — 027_rejet_budget_parametres.sql                        ║
-- ╚══════════════════════════════════════════════════════════════╝

-- 1. REJET DES PROFILS (Membres & Validation)
ALTER TABLE public.personnes DROP CONSTRAINT IF EXISTS personnes_account_status_check;
ALTER TABLE public.personnes ADD CONSTRAINT personnes_account_status_check
  CHECK (account_status IN ('pending_validation', 'validated', 'rejected'));

ALTER TABLE public.personnes
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES public.personnes(id) ON DELETE SET NULL;

-- 2. VALIDATION DE BUDGET DES PROPALES
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS budget_status TEXT NOT NULL DEFAULT 'brouillon'
    CHECK (budget_status IN ('brouillon', 'en_attente_validation', 'valide', 'rejete')),
  ADD COLUMN IF NOT EXISTS budget_comment TEXT,
  ADD COLUMN IF NOT EXISTS budget_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS budget_validated_by UUID REFERENCES public.personnes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS budget_validated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS proposals_budget_status_idx ON public.proposals(budget_status);

-- 3. PARAMÈTRES DE PILOTAGE (Contrôle des données)
INSERT INTO public.parametres (key, value) VALUES
  ('propale_context_situation_default',    ''),
  ('propale_context_intervention_default', 'Audencia Junior Conseil vous accompagne dans la réalisation de votre projet.'),
  ('propale_context_enjeu_default',        ''),
  ('propale_cdc_objectifs_default',        ''),
  ('propale_cdc_contraintes_default',      ''),
  ('propale_cdc_livrables_default',        ''),
  ('prix_jeh_moyen',          '100'),
  ('prix_suivi_jeh_moyen',    '100'),
  ('frais_dossier_moyen',     '50'),
  ('marge_je_moyenne_pct',    '0'),
  ('prix_jeh_min',  '80'),
  ('prix_jeh_max',  '150')
ON CONFLICT (key) DO NOTHING;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║ 2/3 — 027_add_marge_frais_dossier.sql                        ║
-- ╚══════════════════════════════════════════════════════════════╝

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS marge_je       NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frais_dossier  NUMERIC(10,2) DEFAULT 0;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║ 3/3 — 028_marges_recommandees.sql                            ║
-- ╚══════════════════════════════════════════════════════════════╝

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS taille_entreprise TEXT;

CREATE TABLE IF NOT EXISTS public.marges_recommandees (
  taille_entreprise TEXT PRIMARY KEY,
  marge_pct         NUMERIC(5,2) NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.marges_recommandees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read marges" ON public.marges_recommandees;
CREATE POLICY "public read marges" ON public.marges_recommandees
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin write marges" ON public.marges_recommandees;
CREATE POLICY "admin write marges" ON public.marges_recommandees
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.personnes p JOIN public.profils_types pt ON pt.id = p.profil_type_id WHERE p.id = auth.uid() AND pt.slug = 'administrateur'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.personnes p JOIN public.profils_types pt ON pt.id = p.profil_type_id WHERE p.id = auth.uid() AND pt.slug = 'administrateur'));

INSERT INTO public.marges_recommandees (taille_entreprise, marge_pct) VALUES
  ('microentreprise',   5),
  ('petite entreprise', 8),
  ('PME',               10),
  ('ETI',               12),
  ('grand groupe',      15)
ON CONFLICT (taille_entreprise) DO NOTHING;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║ 4 — 029_provenance_phases_budget.sql                         ║
-- ║   Provenance étude + table phases_defaut (seed) + budget_etude║
-- ╚══════════════════════════════════════════════════════════════╝

-- 1. PROVENANCE DE L'ÉTUDE (éditeur de propale)
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS provenance TEXT NOT NULL DEFAULT 'Prospection'
    CHECK (provenance IN ('Appel d''offres', 'Contact spontané', 'Prospection'));

-- 2. PHASES PAR DÉFAUT (remplace local_db/phases.json par une vraie table éditable)
CREATE TABLE IF NOT EXISTS public.phases_defaut (
  id                 INTEGER PRIMARY KEY,
  nom                TEXT NOT NULL,
  objectifs          TEXT,
  methodologie       TEXT,
  contraintes        TEXT,
  jeh_defaut         NUMERIC(10,2) DEFAULT 100,
  intervenants_defaut INTEGER DEFAULT 3,
  duree_semaines     INTEGER DEFAULT 2,
  ordre              INTEGER DEFAULT 0,
  updated_at         TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.phases_defaut ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read phases_defaut" ON public.phases_defaut;
CREATE POLICY "public read phases_defaut" ON public.phases_defaut FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin write phases_defaut" ON public.phases_defaut;
CREATE POLICY "admin write phases_defaut" ON public.phases_defaut FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.personnes p JOIN public.profils_types pt ON pt.id=p.profil_type_id WHERE p.id=auth.uid() AND pt.slug='administrateur'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.personnes p JOIN public.profils_types pt ON pt.id=p.profil_type_id WHERE p.id=auth.uid() AND pt.slug='administrateur'));

INSERT INTO public.phases_defaut (id, nom, objectifs, methodologie, contraintes, jeh_defaut, intervenants_defaut, duree_semaines) VALUES
  (1, 'Recherche et documentation', 'Constituer une base documentaire solide sur le sujet de l''étude afin d''identifier les acteurs clés, les tendances du marché et les meilleures pratiques existantes. Cette phase vise à cartographier l''environnement dans lequel évolue le client.', 'Ciblage des sources d''information pertinentes (rapports sectoriels, études académiques, bases de données spécialisées).
Collecte et tri de la documentation existante.
Synthèse des données collectées sous forme de notes structurées.
Validation des sources par recoupement.', 'Accès limité à certaines bases de données payantes. Vérification systématique de la fiabilité et de la date des sources.', 100, 3, 2),
  (2, 'Création d''un questionnaire', 'Concevoir un outil de collecte de données primaires (questionnaire quantitatif ou guide d''entretien qualitatif) adapté à la problématique du client. L''objectif est d''obtenir des données représentatives et exploitables pour l''analyse.', 'Revue de littérature pour identifier les thèmes clés.
Définition des hypothèses à tester et des informations à collecter.
Rédaction du questionnaire / guide d''entretien.
Test pilote auprès d''un échantillon restreint pour valider la compréhension des questions.
Finalisation et mise en forme du questionnaire.', 'Le questionnaire ne doit pas excéder une durée de passation de 10 minutes pour les formats quantitatifs. Respect des règles RGPD pour la collecte de données personnelles.', 100, 3, 2),
  (3, 'Passation du questionnaire', 'Administrer le questionnaire ou réaliser les entretiens auprès de la cible définie afin d''atteindre un volume de réponses statistiquement significatif. L''objectif est d''obtenir des données fiables et représentatives.', 'Prise de contact avec les répondants cibles (emailing, appels, réseaux sociaux).
Suivi du taux de réponse et relances si nécessaire.
Gestion du fichier de données en temps réel.
Clôture de la collecte une fois le quota atteint.', 'Quota de réponses minimum à atteindre avant clôture. Délai de collecte imposé par le planning global de l''étude.', 100, 3, 2),
  (4, 'Analyse du questionnaire', 'Traiter et interpréter les données collectées (quantitatives ou qualitatives) afin de dégager des tendances, des insights et des enseignements actionnables pour le client.', 'Nettoyage et structuration des données brutes.
Analyse quantitative via outils statistiques (Excel, Google Sheets, SPSS).
Analyse qualitative par codage thématique pour les entretiens.
Visualisation des résultats (graphiques, tableaux croisés).
Interprétation et mise en perspective des résultats.', 'La rigueur statistique est primordiale pour les études quantitatives. Les conclusions doivent rester factuelle et ancrées dans les données.', 100, 3, 2),
  (5, 'Benchmark', 'Analyser les pratiques, offres et performances des acteurs de référence sur un marché ou secteur donné, afin d''identifier les standards du secteur, les innovations et les opportunités de différenciation pour le client.', 'Identification et sélection des acteurs à benchmarker (concurrents directs, indirects, bonnes pratiques hors secteur).
Collecte des données sur les critères retenus (offre, prix, canaux, communication, expérience client).
Analyse comparative et construction d''une grille de benchmark.
Identification des facteurs clés de succès et des axes d''amélioration.
Formulation de recommandations.', 'Accès à l''information limité pour certains acteurs (données non publiques). Le périmètre du benchmark doit être clairement défini avec le client en amont.', 100, 3, 2),
  (6, 'Plan d''action', 'Traduire les enseignements de l''étude en un plan d''action concret, priorisé et opérationnel pour le client. L''objectif est de proposer des recommandations réalistes avec un calendrier de mise en oeuvre.', 'Synthèse des conclusions clés de l''étude.
Identification des leviers d''action prioritaires en concertation avec le client.
Structuration des actions selon une matrice impact/effort.
Rédaction de fiches actions détaillées (quoi, qui, quand, comment, indicateurs).
Présentation et validation du plan avec le client.', 'Les recommandations doivent tenir compte des contraintes budgétaires et opérationnelles du client. Le plan doit être réaliste et actionnable à court et moyen terme.', 100, 3, 2),
  (7, 'Business Plan', 'Élaborer un document de référence complet présentant le projet d''entreprise du client sous ses dimensions stratégique, commerciale, opérationnelle et financière, afin de convaincre des partenaires ou investisseurs.', 'Entretien approfondi avec le client pour comprendre son projet et ses ambitions.
Analyse de marché et étude de la concurrence.
Définition du modèle économique (Business Model Canvas).
Élaboration des projections financières (compte de résultat, plan de trésorerie, seuil de rentabilité).
Rédaction du Business Plan complet et mise en forme finale.', 'Les hypothèses financières doivent être justifiées et prudentes. La cohérence entre le modèle économique et les projections financières est impérative.', 100, 3, 2),
  (8, 'Rétro-planning', 'Construire un planning de projet détaillé permettant au client de visualiser et de piloter l''ensemble des étapes de son projet, en partant de la date de fin souhaitée pour remonter jusqu''au démarrage.', 'Compréhension du contexte et des contraintes temporelles du projet.
Identification de toutes les tâches et jalons clés.
Estimation de la durée de chaque tâche.
Construction du rétro-planning (Gantt ou tableau).
Identification du chemin critique et des risques de délai.', 'Le planning doit intégrer des marges de sécurité raisonnables. Il doit être validé avec le client avant diffusion.', 100, 3, 2),
  (9, 'Création d''une base de données', 'Constituer et structurer un fichier de données organisé (prospects, contacts, partenaires, produits, etc.) répondant aux besoins opérationnels du client, prêt à être exploité et maintenu.', 'Définition des informations à collecter et de la structure de la base (colonnes, catégories).
Identification des sources de données (internet, annuaires, réseaux sociaux, données internes).
Collecte et saisie systématique des données.
Nettoyage et déduplication de la base.
Livraison sous format Excel ou autre outil défini avec le client.', 'Respect du RGPD pour les données à caractère personnel. La qualité des données prime sur la quantité.', 100, 3, 2)
ON CONFLICT (id) DO NOTHING;

-- 3. BUDGET PAR ÉTUDE (1 ligne par phase d'étude — marge effective en %)
CREATE TABLE IF NOT EXISTS public.budget_etude (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etude_id    UUID NOT NULL REFERENCES public.etudes(id) ON DELETE CASCADE,
  phase       TEXT NOT NULL,
  nb_jeh      NUMERIC(10,2) DEFAULT 0,
  prix_jeh    NUMERIC(10,2) DEFAULT 0,
  marge_pct   NUMERIC(5,2) DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS budget_etude_etude_idx ON public.budget_etude(etude_id);

ALTER TABLE public.budget_etude ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth all budget_etude" ON public.budget_etude;
CREATE POLICY "auth all budget_etude" ON public.budget_etude FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║ 5 — OPÉRATIONS (à lancer après les migrations)               ║
-- ╚══════════════════════════════════════════════════════════════╝

-- 5a. Recharge le cache de schéma PostgREST → corrige l'erreur
--     "Could not find the 'budget_comment' column ... in the schema cache".
NOTIFY pgrst, 'reload schema';

-- ════════════════════════════ FIN ══════════════════════════════


-- ╔══════════════════════════════════════════════════════════════╗
-- ║ 037_signature_requests.sql — Signature électronique          ║
-- ║ (LiveConsent) — à exécuter dans le SQL Editor Supabase       ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.signature_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lc_request_id       TEXT UNIQUE NOT NULL,
  request_name        TEXT NOT NULL,
  document_filename   TEXT NOT NULL,
  recipient_firstname TEXT,
  recipient_lastname  TEXT,
  recipient_email     TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'envoyee',
  last_event_code     INTEGER,
  last_event_at       TIMESTAMPTZ,
  events              JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by          UUID REFERENCES public.personnes(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signature_requests_created_at
  ON public.signature_requests (created_at DESC);

ALTER TABLE public.signature_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "signature_requests_select_authenticated" ON public.signature_requests;
CREATE POLICY "signature_requests_select_authenticated"
  ON public.signature_requests FOR SELECT TO authenticated USING (true);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║ 038_signature_ba.sql — Bulletins d'adhésion & file bureau     ║
-- ║ (LiveConsent) — à exécuter dans le SQL Editor Supabase        ║
-- ╚══════════════════════════════════════════════════════════════╝

ALTER TABLE public.signature_requests
  ADD COLUMN IF NOT EXISTS category         TEXT NOT NULL DEFAULT 'libre',
  ADD COLUMN IF NOT EXISTS personne_id      UUID REFERENCES public.personnes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signers          JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS validity_days    INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS expires_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_count   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived         BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.signature_requests
  DROP CONSTRAINT IF EXISTS signature_requests_category_check;
ALTER TABLE public.signature_requests
  ADD CONSTRAINT signature_requests_category_check
  CHECK (category IN ('libre','ba'));

CREATE INDEX IF NOT EXISTS idx_signature_requests_category
  ON public.signature_requests (category);
CREATE INDEX IF NOT EXISTS idx_signature_requests_personne
  ON public.signature_requests (personne_id);
CREATE INDEX IF NOT EXISTS idx_signature_requests_expires_at
  ON public.signature_requests (expires_at) WHERE archived = false;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES public.personnes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON public.notifications (recipient_id, read);

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid());


-- ===================================================================
-- ===== 039_roles_postes.sql =====
-- Sous-rôles AJC : postes (bureau/pôles) cumulés au rôle de base d'une personne.
-- Permissions effectives = rôle_base.permissions ∪ union(postes.permissions).
-- ===================================================================

ALTER TABLE public.profils_types
  ADD COLUMN IF NOT EXISTS categorie TEXT NOT NULL DEFAULT 'base';

ALTER TABLE public.profils_types
  DROP CONSTRAINT IF EXISTS profils_types_categorie_check;
ALTER TABLE public.profils_types
  ADD CONSTRAINT profils_types_categorie_check
  CHECK (categorie IN ('base','bureau','pole'));

CREATE TABLE IF NOT EXISTS public.personne_postes (
  personne_id UUID NOT NULL REFERENCES public.personnes(id) ON DELETE CASCADE,
  poste_id    UUID NOT NULL REFERENCES public.profils_types(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (personne_id, poste_id)
);

ALTER TABLE public.personne_postes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "personne_postes_select" ON public.personne_postes;
CREATE POLICY "personne_postes_select" ON public.personne_postes
  FOR SELECT USING (
    personne_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.personnes p
      JOIN public.profils_types pt ON pt.id = p.profil_type_id
      WHERE p.id = auth.uid() AND pt.slug = 'administrateur'
    )
  );

INSERT INTO public.profils_types (nom, slug, permissions, est_defaut, categorie) VALUES
  ('Présidente',                    'presidente',         '{"signer_documents":true,"signer_ba":true,"voir_factures":true}', false, 'bureau'),
  ('Vice-Présidente',               'vice_presidente',    '{}', false, 'bureau'),
  ('Trésorier·ère',                 'tresorier',          '{"signer_documents":true,"voir_factures":true}', false, 'bureau'),
  ('Secrétaire Général',            'secretaire_general', '{}', false, 'bureau'),
  ('Pôle Audit Qualité',            'pole_audit_qualite', '{}', false, 'pole'),
  ('Pôle Développement Commercial', 'pole_dev_co',        '{}', false, 'pole'),
  ('Pôle Ressources Humaines',      'pole_rh',            '{"signer_ba":true,"assigner_intervenants":true}', false, 'pole'),
  ('Pôle Systèmes d''Information',  'pole_si',            '{}', false, 'pole'),
  ('Pôle Marketing',                'pole_marketing',     '{}', false, 'pole')
ON CONFLICT (slug) DO NOTHING;


-- ===================================================================
-- ===== 040_responsable_rh.sql =====
-- Poste « Responsable RH » (plus de droits que le pôle RH) + ajustements signer_ba.
-- ===================================================================

INSERT INTO public.profils_types (nom, slug, permissions, est_defaut, categorie) VALUES
  ('Responsable RH', 'responsable_rh', '{"signer_ba":true,"assigner_intervenants":true}', false, 'pole')
ON CONFLICT (slug) DO NOTHING;

UPDATE public.profils_types
  SET permissions = permissions - 'signer_ba'
  WHERE slug = 'pole_rh';

UPDATE public.profils_types
  SET permissions = permissions || '{"signer_ba":true}'::jsonb
  WHERE slug = 'tresorier';

-- ===================================================================
-- ===== 041_intervenant_create_collaboration.sql =====
-- Corrige : l'intervenant assigné ne pouvait pas créer sa propre ligne
-- mission_collaborations (RLS ne l'autorisait que pour le chef_projet),
-- d'où le message trompeur "Un intervenant doit être assigné".
-- ===================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mission_collaborations' AND policyname='intervenant create mission_collaborations') THEN
    CREATE POLICY "intervenant create mission_collaborations" ON public.mission_collaborations FOR INSERT TO authenticated
      WITH CHECK (
        intervenant_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.missions m
          WHERE m.id = mission_id AND m.intervenant_id = auth.uid()
        )
      );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- ===== 042_import_members_columns.sql =====
-- Colonnes de reprise Be Quick (legacy_bequick_id, civilite, competences)
-- + renommage du rôle membre_agc -> membre_ajc.
-- ===================================================================

ALTER TABLE public.personnes
  ADD COLUMN IF NOT EXISTS legacy_bequick_id INTEGER,
  ADD COLUMN IF NOT EXISTS civilite TEXT,
  ADD COLUMN IF NOT EXISTS competences TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS personnes_legacy_bequick_id_key
  ON public.personnes (legacy_bequick_id)
  WHERE legacy_bequick_id IS NOT NULL;

UPDATE public.profils_types
  SET slug = 'membre_ajc', nom = 'Membre AJC'
  WHERE slug = 'membre_agc';

NOTIFY pgrst, 'reload schema';
