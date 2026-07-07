-- ============================================================
-- Migration 046 : Alignement des balises de documents
-- Ajoute les colonnes nécessaires pour que les templates Word
-- déjà balisés ({entreprise.*}, {signataire.*}, {junior.*} devenu
-- {structure.*}, {facturation.*}) puissent être remplis
-- automatiquement par buildTemplateContext().
-- ============================================================

-- ------------------------------------------------------------
-- 1. CLIENTS — adresse complète + détail du contact signataire
-- Nécessaire pour {entreprise.adresse/code_postal/ville/pays}
-- et {signataire.civilite/prenom/poste}.
-- ------------------------------------------------------------
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS adresse TEXT,
  ADD COLUMN IF NOT EXISTS code_postal TEXT,
  ADD COLUMN IF NOT EXISTS ville TEXT,
  ADD COLUMN IF NOT EXISTS pays TEXT NOT NULL DEFAULT 'France',
  ADD COLUMN IF NOT EXISTS contact_prenom TEXT,
  ADD COLUMN IF NOT EXISTS contact_civilite TEXT CHECK (contact_civilite IN ('Monsieur', 'Madame')),
  ADD COLUMN IF NOT EXISTS contact_poste TEXT;

-- ------------------------------------------------------------
-- 2. ETUDES — références contractuelles pour les PV/avenants
-- reference_dernier_avenant : NULL/vide = pas d'avenant signé.
-- ------------------------------------------------------------
ALTER TABLE public.etudes
  ADD COLUMN IF NOT EXISTS reference_convention_client TEXT,
  ADD COLUMN IF NOT EXISTS reference_dernier_avenant TEXT;

-- ------------------------------------------------------------
-- 3. FACTURES — type de facture (acompte/intermédiaire/solde)
-- ------------------------------------------------------------
ALTER TABLE public.factures
  ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('acompte', 'intermediaire', 'solde')),
  ADD COLUMN IF NOT EXISTS accompte_pct NUMERIC(5,2);

-- ------------------------------------------------------------
-- 4. PARAMETRES — statut juridique, banque, TVA :
-- PAS de nouvelles clés. Le moteur de documents lit les clés déjà
-- éditées dans Administration ▸ Paramètres : statuts_juridiques,
-- rib, domiciliation, ordre_paiements, tva_rate, iban, bic.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 5. PARAMETRES — Bulletin de Versement : cotisations URSSAF
-- ⚠️ TAUX À REMPLIR PAR LE TRÉSORIER avant la première génération
-- de Bulletin de Versement (Administration → Paramètres, ou SQL).
-- Tous les taux sont en % ; bv_base_urssaf est l'assiette
-- forfaitaire par JEH en euros (montant publié chaque année).
-- Un taux à 0 = ligne affichée vide (comportement du modèle CNJE).
-- ------------------------------------------------------------
INSERT INTO public.parametres (key, value) VALUES
  ('bv_base_urssaf',          '0'),      -- Assiette forfaitaire par JEH (€)
  ('bv_csg_assiette_pct',     '98.25'),  -- Assiette CSG/CRDS en % de la rétribution brute
  -- Santé
  ('bv_am_taux_junior',       '0'),      -- Assurance Maladie — part Junior
  ('bv_am_taux_etudiant',     '0'),      -- Assurance Maladie — part étudiant
  ('bv_at_taux_junior',       '0'),      -- Accident du travail — part Junior
  ('bv_at_taux_etudiant',     '0'),
  -- Retraite
  ('bv_avp_taux_junior',      '0'),      -- Vieillesse plafonnée
  ('bv_avp_taux_etudiant',    '0'),
  ('bv_avd_taux_junior',      '0'),      -- Vieillesse déplafonnée
  ('bv_avd_taux_etudiant',    '0'),
  -- Famille / autres
  ('bv_af_taux_junior',       '0'),      -- Allocations familiales
  ('bv_af_taux_etudiant',     '0'),
  ('bv_autre_taux_junior',    '0'),      -- Autres contributions (CSA…)
  ('bv_autre_taux_etudiant',  '0'),
  -- CSG / CRDS (assises sur bv_csg_assiette_pct % de la rétribution brute)
  ('bv_csg_taux_junior',      '0'),
  ('bv_csg_taux_etudiant',    '0'),      -- CSG déductible
  ('bv_crdscsg_taux_junior',  '0'),
  ('bv_crdscsg_taux_etudiant','0')       -- CSG/CRDS non déductible
ON CONFLICT (key) DO NOTHING;
