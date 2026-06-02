-- ============================================================
-- Migration 027 : Rejet de profils + Validation de budget des
-- propales + Paramètres de pilotage (Contrôle des données)
-- Regroupe les besoins schéma des 3 chantiers pour éviter les
-- collisions de migrations.
-- ============================================================

-- ------------------------------------------------------------
-- 1. REJET DES PROFILS (Membres & Validation)
-- account_status accepte désormais 'rejected' + motif optionnel.
-- ------------------------------------------------------------
ALTER TABLE public.personnes DROP CONSTRAINT IF EXISTS personnes_account_status_check;
ALTER TABLE public.personnes ADD CONSTRAINT personnes_account_status_check
  CHECK (account_status IN ('pending_validation', 'validated', 'rejected'));

ALTER TABLE public.personnes
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES public.personnes(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- 2. VALIDATION DE BUDGET DES PROPALES
-- Une propale dont le budget n'est pas validé ne peut pas être
-- réalisée (passage en CE / signature bloqué côté applicatif).
-- ------------------------------------------------------------
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS budget_status TEXT NOT NULL DEFAULT 'brouillon'
    CHECK (budget_status IN ('brouillon', 'en_attente_validation', 'valide', 'rejete')),
  ADD COLUMN IF NOT EXISTS budget_comment TEXT,
  ADD COLUMN IF NOT EXISTS budget_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS budget_validated_by UUID REFERENCES public.personnes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS budget_validated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS proposals_budget_status_idx ON public.proposals(budget_status);

-- ------------------------------------------------------------
-- 3. PARAMÈTRES DE PILOTAGE (Contrôle des données)
-- Réutilise la table public.parametres (key/value, RLS admin en
-- écriture déjà posée par la migration 012).
-- ------------------------------------------------------------
INSERT INTO public.parametres (key, value) VALUES
  -- Contenu par défaut des propositions
  ('propale_context_situation_default',    ''),
  ('propale_context_intervention_default', 'Audencia Junior Conseil vous accompagne dans la réalisation de votre projet.'),
  ('propale_context_enjeu_default',        ''),
  ('propale_cdc_objectifs_default',        ''),
  ('propale_cdc_contraintes_default',      ''),
  ('propale_cdc_livrables_default',        ''),
  -- Prix moyens (€)
  ('prix_jeh_moyen',          '100'),
  ('prix_suivi_jeh_moyen',    '100'),
  ('frais_dossier_moyen',     '50'),
  ('marge_je_moyenne_pct',    '0'),
  -- Fourchettes de prix (€) — bornes basse/haute du JEH
  ('prix_jeh_min',  '80'),
  ('prix_jeh_max',  '150')
ON CONFLICT (key) DO NOTHING;
