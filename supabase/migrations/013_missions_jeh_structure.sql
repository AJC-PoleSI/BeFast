-- Migration 013: JEH sur missions/blocs + paramètres structure étendus

-- ============================================================
-- MISSIONS : nb_jeh, nb_intervenants, langues
-- ============================================================
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS nb_jeh NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS nb_intervenants INTEGER,
  ADD COLUMN IF NOT EXISTS langues TEXT[];

-- ============================================================
-- ECHEANCIER : jeh par bloc
-- ============================================================
ALTER TABLE public.echeancier_blocs
  ADD COLUMN IF NOT EXISTS jeh NUMERIC(6,1);

-- ============================================================
-- PARAMETRES STRUCTURE : seeds des clés par défaut
-- ============================================================
INSERT INTO public.parametres (key, value, description) VALUES
  ('raison_sociale', '', 'Raison sociale de la structure'),
  ('statuts_juridiques', '', 'Statuts juridiques'),
  ('tribunal', '', 'Tribunal de commerce'),
  ('passation', '', 'Date de passation'),
  ('numero_prochaine_facture', '1', 'Numéro prochaine facture'),
  ('numero_prochaine_mission', '1', 'Numéro prochaine mission'),
  ('numero_prochain_bv', '1', 'Numéro prochain BV'),
  ('numero_prochain_avenant', '1', 'Numéro prochain avenant'),
  ('president_nom', '', 'Nom président(e)'),
  ('president_genre', 'F', 'Genre président(e) M/F'),
  ('vice_president_nom', '', 'Nom vice-président(e)'),
  ('vice_president_genre', 'F', 'Genre vice-président(e) M/F'),
  ('tresorier_nom', '', 'Nom trésorier(e)'),
  ('tresorier_genre', 'F', 'Genre trésorier(e) M/F'),
  ('sg_nom', '', 'Nom secrétaire général(e)'),
  ('sg_genre', 'F', 'Genre SG M/F'),
  ('rh_nom', '', 'Nom responsable RH'),
  ('rh_genre', 'F', 'Genre RH M/F'),
  ('responsable_localite_nom', '', 'Nom responsable localité'),
  ('responsable_localite_genre', 'F', 'Genre localité M/F'),
  ('devco_nom', '', 'Nom responsable DEVCO'),
  ('devco_genre', 'F', 'Genre DEVCO M/F'),
  ('si_nom', '', 'Nom responsable SI'),
  ('si_genre', 'F', 'Genre SI M/F'),
  ('frais_structure', '0', 'Frais de structure (%)'),
  ('remuneration_defaut', '0', 'Rémunération par défaut par JEH'),
  ('rib', '', 'RIB association'),
  ('domiciliation', '', 'Domiciliation bancaire'),
  ('iban', '', 'IBAN association'),
  ('bic', '', 'BIC'),
  ('adresse_1', '', 'Adresse ligne 1'),
  ('adresse_2', '', 'Adresse ligne 2'),
  ('code_postal', '', 'Code postal'),
  ('ville', '', 'Ville'),
  ('telephone', '', 'Téléphone'),
  ('email_contact', '', 'Email contact'),
  ('site_web', '', 'Site web'),
  ('nom_ecole', '', 'Nom école/université'),
  ('siret', '', 'SIRET'),
  ('code_ape', '', 'Code APE'),
  ('numero_urssaf', '', 'Numéro URSSAF'),
  ('numero_tva', '', 'Numéro TVA intracommunautaire'),
  ('ordre_paiements', '', 'Ordre de paiements (chèques)')
ON CONFLICT (key) DO NOTHING;
