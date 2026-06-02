-- Migration 026: Module Propositions commerciales
-- Réutilise l'existant (personnes = CDP, clients, etudes, echeancier_blocs)
-- et n'ajoute que le strictement nécessaire :
--   - colonnes commerciales sur clients / echeancier_blocs
--   - table etude_propale (contenu commercial, 1:1 avec etudes)
--   - table catalog_phases (phases types par défaut)
-- Modèle : une proposition = une `etude` au statut 'prospect'.

-- ============================================================
-- 1. CLIENTS : champs contact manquants pour la propale
-- ============================================================
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS contact_prenom      TEXT,
  ADD COLUMN IF NOT EXISTS contact_civilite    TEXT DEFAULT 'M.',
  ADD COLUMN IF NOT EXISTS is_autoentrepreneur BOOLEAN DEFAULT false;

-- ============================================================
-- 2. ECHEANCIER_BLOCS : contenu d'une phase de proposition
--    (la table porte déjà nom, semaine_debut, duree_semaines, couleur, ordre)
-- ============================================================
ALTER TABLE public.echeancier_blocs
  ADD COLUMN IF NOT EXISTS objectifs           TEXT,
  ADD COLUMN IF NOT EXISTS methodologie        TEXT,
  ADD COLUMN IF NOT EXISTS contraintes         TEXT,
  ADD COLUMN IF NOT EXISTS intervenants_count  NUMERIC(5,1) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS intervenants_niveau TEXT,            -- L3 | M1 | M2
  ADD COLUMN IF NOT EXISTS jeh_count           INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS jeh_price           NUMERIC(10,2) DEFAULT 100,
  ADD COLUMN IF NOT EXISTS start_after_order   INTEGER;         -- ordre du bloc précédent, NULL = début projet

-- ============================================================
-- 3. ETUDE_PROPALE : contenu commercial (1:1 avec etudes)
--    Les clés secondaires (client_id, suiveur_id=CDP) restent sur `etudes`.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.etude_propale (
  etude_id              UUID PRIMARY KEY REFERENCES public.etudes(id) ON DELETE CASCADE,

  -- Statut commercial (distinct du statut métier de l'étude)
  propale_statut        TEXT NOT NULL DEFAULT 'envoyée',  -- envoyée | validée | refusée | CE éditée

  -- Type d'étude affiché (libellé libre)
  study_type            TEXT,

  -- Contexte
  contexte_situation    TEXT,
  contexte_intervention TEXT,
  contexte_enjeu        TEXT,

  -- Cahier des charges
  cdc_objectifs         TEXT,
  cdc_contraintes       TEXT,
  cdc_livrables         TEXT,

  -- Budget / suivi
  suivi_jeh_count       INTEGER DEFAULT 1,
  suivi_jeh_price       NUMERIC(10,2) DEFAULT 200,
  global_frais_annexes  NUMERIC(10,2) DEFAULT 0,
  total_ht              NUMERIC(12,2) DEFAULT 0,
  total_ttc             NUMERIC(12,2) DEFAULT 0,

  -- Snapshot client (le client peut être saisi en texte libre, hors table clients)
  is_autoentrepreneur   BOOLEAN DEFAULT false,
  client_company        TEXT,
  client_civilite       TEXT,
  client_first_name     TEXT,
  client_last_name      TEXT,
  client_email          TEXT,
  client_phone          TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.etude_propale ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='etude_propale' AND policyname='authenticated read etude_propale') THEN
    CREATE POLICY "authenticated read etude_propale" ON public.etude_propale FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='etude_propale' AND policyname='authenticated write etude_propale') THEN
    CREATE POLICY "authenticated write etude_propale" ON public.etude_propale FOR ALL TO authenticated
      USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

CREATE TRIGGER etude_propale_updated_at BEFORE UPDATE ON public.etude_propale
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 4. CATALOG_PHASES : phases types par défaut (ex local_db/phases.json)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.catalog_phases (
  id                 SERIAL PRIMARY KEY,
  name               TEXT NOT NULL,
  objectifs          TEXT,
  methodologie       TEXT,
  contraintes        TEXT,
  duree_semaines     INTEGER DEFAULT 2,
  intervenants_count INTEGER DEFAULT 3,
  jeh_price          NUMERIC(10,2) DEFAULT 100,
  is_active          BOOLEAN DEFAULT true,
  ordre              INTEGER DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.catalog_phases ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='catalog_phases' AND policyname='authenticated read catalog_phases') THEN
    CREATE POLICY "authenticated read catalog_phases" ON public.catalog_phases FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='catalog_phases' AND policyname='admin manage catalog_phases') THEN
    CREATE POLICY "admin manage catalog_phases" ON public.catalog_phases FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.personnes p JOIN public.profils_types pt ON pt.id = p.profil_type_id WHERE p.id = auth.uid() AND pt.slug = 'administrateur'))
      WITH CHECK (EXISTS (SELECT 1 FROM public.personnes p JOIN public.profils_types pt ON pt.id = p.profil_type_id WHERE p.id = auth.uid() AND pt.slug = 'administrateur'));
  END IF;
END $$;

-- Seed des phases types (depuis local_db/phases.json)
INSERT INTO public.catalog_phases (name, objectifs, methodologie, contraintes, duree_semaines, intervenants_count, jeh_price, ordre) VALUES
  ('Recherche et documentation',
   'Constituer une base documentaire solide sur le sujet de l''étude afin d''identifier les acteurs clés, les tendances du marché et les meilleures pratiques existantes. Cette phase vise à cartographier l''environnement dans lequel évolue le client.',
   E'- Ciblage des sources d''information pertinentes (rapports sectoriels, études académiques, bases de données spécialisées).\n- Collecte et tri de la documentation existante.\n- Synthèse des données collectées sous forme de notes structurées.\n- Validation des sources par recoupement.',
   'Accès limité à certaines bases de données payantes. Vérification systématique de la fiabilité et de la date des sources.', 2, 3, 100, 1),
  ('Création d''un questionnaire',
   'Concevoir un outil de collecte de données primaires (questionnaire quantitatif ou guide d''entretien qualitatif) adapté à la problématique du client. L''objectif est d''obtenir des données représentatives et exploitables pour l''analyse.',
   E'- Revue de littérature pour identifier les thèmes clés.\n- Définition des hypothèses à tester et des informations à collecter.\n- Rédaction du questionnaire / guide d''entretien.\n- Test pilote auprès d''un échantillon restreint pour valider la compréhension des questions.\n- Finalisation et mise en forme du questionnaire.',
   'Le questionnaire ne doit pas excéder une durée de passation de 10 minutes pour les formats quantitatifs. Respect des règles RGPD pour la collecte de données personnelles.', 2, 3, 100, 2),
  ('Passation du questionnaire',
   'Administrer le questionnaire ou réaliser les entretiens auprès de la cible définie afin d''atteindre un volume de réponses statistiquement significatif. L''objectif est d''obtenir des données fiables et représentatives.',
   E'- Prise de contact avec les répondants cibles (emailing, appels, réseaux sociaux).\n- Suivi du taux de réponse et relances si nécessaire.\n- Gestion du fichier de données en temps réel.\n- Clôture de la collecte une fois le quota atteint.',
   'Quota de réponses minimum à atteindre avant clôture. Délai de collecte imposé par le planning global de l''étude.', 2, 3, 100, 3),
  ('Analyse du questionnaire',
   'Traiter et interpréter les données collectées (quantitatives ou qualitatives) afin de dégager des tendances, des insights et des enseignements actionnables pour le client.',
   E'- Nettoyage et structuration des données brutes.\n- Analyse quantitative via outils statistiques (Excel, Google Sheets, SPSS).\n- Analyse qualitative par codage thématique pour les entretiens.\n- Visualisation des résultats (graphiques, tableaux croisés).\n- Interprétation et mise en perspective des résultats.',
   'La rigueur statistique est primordiale pour les études quantitatives. Les conclusions doivent rester factuelles et ancrées dans les données.', 2, 3, 100, 4),
  ('Benchmark',
   'Analyser les pratiques, offres et performances des acteurs de référence sur un marché ou secteur donné, afin d''identifier les standards du secteur, les innovations et les opportunités de différenciation pour le client.',
   E'- Identification et sélection des acteurs à benchmarker (concurrents directs, indirects, bonnes pratiques hors secteur).\n- Collecte des données sur les critères retenus (offre, prix, canaux, communication, expérience client).\n- Analyse comparative et construction d''une grille de benchmark.\n- Identification des facteurs clés de succès et des axes d''amélioration.\n- Formulation de recommandations.',
   'Accès à l''information limité pour certains acteurs (données non publiques). Le périmètre du benchmark doit être clairement défini avec le client en amont.', 2, 3, 100, 5),
  ('Plan d''action',
   'Traduire les enseignements de l''étude en un plan d''action concret, priorisé et opérationnel pour le client. L''objectif est de proposer des recommandations réalistes avec un calendrier de mise en oeuvre.',
   E'- Synthèse des conclusions clés de l''étude.\n- Identification des leviers d''action prioritaires en concertation avec le client.\n- Structuration des actions selon une matrice impact/effort.\n- Rédaction de fiches actions détaillées (quoi, qui, quand, comment, indicateurs).\n- Présentation et validation du plan avec le client.',
   'Les recommandations doivent tenir compte des contraintes budgétaires et opérationnelles du client. Le plan doit être réaliste et actionnable à court et moyen terme.', 2, 3, 100, 6),
  ('Business Plan',
   'Élaborer un document de référence complet présentant le projet d''entreprise du client sous ses dimensions stratégique, commerciale, opérationnelle et financière, afin de convaincre des partenaires ou investisseurs.',
   E'- Entretien approfondi avec le client pour comprendre son projet et ses ambitions.\n- Analyse de marché et étude de la concurrence.\n- Définition du modèle économique (Business Model Canvas).\n- Élaboration des projections financières (compte de résultat, plan de trésorerie, seuil de rentabilité).\n- Rédaction du Business Plan complet et mise en forme finale.',
   'Les hypothèses financières doivent être justifiées et prudentes. La cohérence entre le modèle économique et les projections financières est impérative.', 2, 3, 100, 7),
  ('Rétro-planning',
   'Construire un planning de projet détaillé permettant au client de visualiser et de piloter l''ensemble des étapes de son projet, en partant de la date de fin souhaitée pour remonter jusqu''au démarrage.',
   E'- Compréhension du contexte et des contraintes temporelles du projet.\n- Identification de toutes les tâches et jalons clés.\n- Estimation de la durée de chaque tâche.\n- Construction du rétro-planning (Gantt ou tableau).\n- Identification du chemin critique et des risques de délai.',
   'Le planning doit intégrer des marges de sécurité raisonnables. Il doit être validé avec le client avant diffusion.', 2, 3, 100, 8),
  ('Création d''une base de données',
   'Constituer et structurer un fichier de données organisé (prospects, contacts, partenaires, produits, etc.) répondant aux besoins opérationnels du client, prêt à être exploité et maintenu.',
   E'- Définition des informations à collecter et de la structure de la base (colonnes, catégories).\n- Identification des sources de données (internet, annuaires, réseaux sociaux, données internes).\n- Collecte et saisie systématique des données.\n- Nettoyage et déduplication de la base.\n- Livraison sous format Excel ou autre outil défini avec le client.',
   'Respect du RGPD pour les données à caractère personnel. La qualité des données prime sur la quantité.', 2, 3, 100, 9)
ON CONFLICT DO NOTHING;
