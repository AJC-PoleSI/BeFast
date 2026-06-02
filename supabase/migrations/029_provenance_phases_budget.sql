-- ============================================================
-- Migration 029 : Provenance des études + Pilotage des phases
-- + Suivi de la marge effective par étude (budget_etude)
-- ============================================================

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

