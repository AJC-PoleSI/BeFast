-- Migration 027: données de TEST pour le module Propositions
-- À exécuter APRÈS 026. Tous les textes commencent par "test" => supprimables facilement.
-- Idempotent : ré-exécutable sans créer de doublons (guardé par numero / nom).
-- Pour tout supprimer :
--   DELETE FROM public.etudes WHERE numero LIKE 'TEST-%';        -- cascade etude_propale + echeancier_blocs
--   DELETE FROM public.clients WHERE nom LIKE 'test %';
--   DELETE FROM public.catalog_phases WHERE name LIKE 'test %';

DO $$
DECLARE
  v_suiveur UUID;
  v_client_a UUID;
  v_client_b UUID;
  v_client_c UUID;
  v_etude UUID;
BEGIN
  -- CDP "suiveur" : on prend une personne nommée (sinon n'importe laquelle)
  SELECT id INTO v_suiveur FROM public.personnes WHERE prenom IS NOT NULL ORDER BY created_at LIMIT 1;
  IF v_suiveur IS NULL THEN
    SELECT id INTO v_suiveur FROM public.personnes LIMIT 1;
  END IF;

  -- ===================== CLIENTS (test) =====================
  INSERT INTO public.clients (nom, secteur, type, actif, contact_civilite, contact_prenom, contact_nom, contact_email, contact_phone, is_autoentrepreneur)
  SELECT 'test Boulangerie du Coin', 'test Alimentaire', 'prospection', true, 'Mme', 'test Marie', 'test Lefebvre', 'test.marie@exemple.fr', '06 00 00 00 01', false
  WHERE NOT EXISTS (SELECT 1 FROM public.clients WHERE nom = 'test Boulangerie du Coin');

  INSERT INTO public.clients (nom, secteur, type, actif, contact_civilite, contact_prenom, contact_nom, contact_email, contact_phone, is_autoentrepreneur)
  SELECT 'test Startup InnovTech', 'test Tech', 'cs', true, 'M.', 'test Pierre', 'test Dubois', 'test.pierre@exemple.fr', '06 00 00 00 02', false
  WHERE NOT EXISTS (SELECT 1 FROM public.clients WHERE nom = 'test Startup InnovTech');

  INSERT INTO public.clients (nom, secteur, type, actif, contact_civilite, contact_prenom, contact_nom, contact_email, contact_phone, is_autoentrepreneur)
  SELECT 'test Cabinet Conseil RH', 'test Services', 'ao', true, 'M.', 'test Karim', 'test Benali', 'test.karim@exemple.fr', '06 00 00 00 03', false
  WHERE NOT EXISTS (SELECT 1 FROM public.clients WHERE nom = 'test Cabinet Conseil RH');

  SELECT id INTO v_client_a FROM public.clients WHERE nom = 'test Boulangerie du Coin';
  SELECT id INTO v_client_b FROM public.clients WHERE nom = 'test Startup InnovTech';
  SELECT id INTO v_client_c FROM public.clients WHERE nom = 'test Cabinet Conseil RH';

  -- ===================== CATALOGUE DE PHASES (test) =====================
  -- (la migration 026 seede déjà 9 phases ; on ajoute une phase test repérable)
  INSERT INTO public.catalog_phases (name, objectifs, methodologie, contraintes, duree_semaines, intervenants_count, jeh_price, ordre)
  SELECT 'test Phase exemple', 'test objectifs de la phase exemple', 'test méthodologie de la phase exemple', 'test contraintes éventuelles', 2, 3, 100, 99
  WHERE NOT EXISTS (SELECT 1 FROM public.catalog_phases WHERE name = 'test Phase exemple');

  -- ===================== PROPALE 1 : Étude de marché =====================
  IF NOT EXISTS (SELECT 1 FROM public.etudes WHERE numero = 'TEST-PROP-001') THEN
    INSERT INTO public.etudes (numero, nom, client_id, suiveur_id, statut, budget_ht, date_debut)
    VALUES ('TEST-PROP-001', 'test Étude de marché', v_client_a, v_suiveur, 'prospect', 3300, CURRENT_DATE)
    RETURNING id INTO v_etude;

    INSERT INTO public.etude_propale (etude_id, propale_statut, study_type, contexte_situation, contexte_intervention, contexte_enjeu,
      cdc_objectifs, cdc_contraintes, cdc_livrables, suivi_jeh_count, suivi_jeh_price, global_frais_annexes, total_ht, total_ttc,
      is_autoentrepreneur, client_company, client_civilite, client_first_name, client_last_name, client_email, client_phone)
    VALUES (v_etude, 'envoyée', 'test Étude de marché',
      'test situation actuelle du client', 'test domaine d''intervention AJC', 'test enjeu principal du projet',
      'test objectifs globaux', 'test contraintes globales', 'test livrables attendus',
      1, 200, 0, 3300, 3960,
      false, 'test Boulangerie du Coin', 'Mme', 'test Marie', 'test Lefebvre', 'test.marie@exemple.fr', '06 00 00 00 01');

    INSERT INTO public.echeancier_blocs (etude_id, nom, ordre, semaine_debut, duree_semaines, start_after_order, objectifs, methodologie, contraintes, intervenants_count, intervenants_niveau, jeh_count, jeh_price) VALUES
      (v_etude, 'test Cadrage', 0, 1, 2, NULL, 'test objectifs cadrage', 'test méthodo cadrage', 'test contraintes cadrage', 1, 'L3', 1, 100),
      (v_etude, 'test Analyse', 1, 3, 4, 0, 'test objectifs analyse', 'test méthodo analyse', 'test contraintes analyse', 2, 'M1', 2, 100),
      (v_etude, 'test Synthèse', 2, 7, 2, 1, 'test objectifs synthèse', 'test méthodo synthèse', 'test contraintes synthèse', 1, 'M2', 1, 100);
  END IF;

  -- ===================== PROPALE 2 : Business Plan =====================
  IF NOT EXISTS (SELECT 1 FROM public.etudes WHERE numero = 'TEST-PROP-002') THEN
    INSERT INTO public.etudes (numero, nom, client_id, suiveur_id, statut, budget_ht, date_debut)
    VALUES ('TEST-PROP-002', 'test Business Plan', v_client_b, v_suiveur, 'prospect', 2200, CURRENT_DATE)
    RETURNING id INTO v_etude;

    INSERT INTO public.etude_propale (etude_id, propale_statut, study_type, contexte_situation, contexte_intervention, contexte_enjeu,
      cdc_objectifs, cdc_contraintes, cdc_livrables, suivi_jeh_count, suivi_jeh_price, global_frais_annexes, total_ht, total_ttc,
      is_autoentrepreneur, client_company, client_civilite, client_first_name, client_last_name, client_email, client_phone)
    VALUES (v_etude, 'envoyée', 'test Business Plan',
      'test situation startup', 'test accompagnement stratégique', 'test levée de fonds',
      'test objectifs BP', 'test contraintes BP', 'test livrables BP',
      1, 200, 0, 2200, 2640,
      false, 'test Startup InnovTech', 'M.', 'test Pierre', 'test Dubois', 'test.pierre@exemple.fr', '06 00 00 00 02');

    INSERT INTO public.echeancier_blocs (etude_id, nom, ordre, semaine_debut, duree_semaines, start_after_order, objectifs, methodologie, contraintes, intervenants_count, intervenants_niveau, jeh_count, jeh_price) VALUES
      (v_etude, 'test Recherche', 0, 1, 3, NULL, 'test objectifs recherche', 'test méthodo recherche', 'test contraintes', 1, 'L3', 1, 100),
      (v_etude, 'test Modélisation financière', 1, 4, 4, 0, 'test objectifs modélisation', 'test méthodo modélisation', 'test contraintes', 2, 'M2', 2, 100);
  END IF;

  -- ===================== PROPALE 3 : Benchmark (auto-entrepreneur) =====================
  IF NOT EXISTS (SELECT 1 FROM public.etudes WHERE numero = 'TEST-PROP-003') THEN
    INSERT INTO public.etudes (numero, nom, client_id, suiveur_id, statut, budget_ht, date_debut)
    VALUES ('TEST-PROP-003', 'test Benchmark concurrentiel', v_client_c, v_suiveur, 'prospect', 1500, CURRENT_DATE)
    RETURNING id INTO v_etude;

    INSERT INTO public.etude_propale (etude_id, propale_statut, study_type, contexte_situation, contexte_intervention, contexte_enjeu,
      cdc_objectifs, cdc_contraintes, cdc_livrables, suivi_jeh_count, suivi_jeh_price, global_frais_annexes, total_ht, total_ttc,
      is_autoentrepreneur, client_company, client_civilite, client_first_name, client_last_name, client_email, client_phone)
    VALUES (v_etude, 'validée', 'test Benchmark concurrentiel',
      'test situation cabinet', 'test analyse comparative', 'test positionnement marché',
      'test objectifs benchmark', 'test contraintes benchmark', 'test livrables benchmark',
      1, 200, 50, 1500, 1800,
      false, 'test Cabinet Conseil RH', 'M.', 'test Karim', 'test Benali', 'test.karim@exemple.fr', '06 00 00 00 03');

    INSERT INTO public.echeancier_blocs (etude_id, nom, ordre, semaine_debut, duree_semaines, start_after_order, objectifs, methodologie, contraintes, intervenants_count, intervenants_niveau, jeh_count, jeh_price) VALUES
      (v_etude, 'test Collecte', 0, 1, 2, NULL, 'test objectifs collecte', 'test méthodo collecte', 'test contraintes', 2, 'L3', 2, 100),
      (v_etude, 'test Grille comparative', 1, 3, 2, 0, 'test objectifs grille', 'test méthodo grille', 'test contraintes', 1, 'M1', 1, 100),
      (v_etude, 'test Recommandations', 2, 5, 1, 1, 'test objectifs reco', 'test méthodo reco', 'test contraintes', 1, 'M2', 1, 100);
  END IF;

END $$;
