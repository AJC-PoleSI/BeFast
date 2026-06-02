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

-- ════════════════════════════ FIN ══════════════════════════════
