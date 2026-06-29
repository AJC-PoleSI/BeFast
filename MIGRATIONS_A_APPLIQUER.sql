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
-- ⚠️ Le seed des phases est long : colle plutôt le CONTENU COMPLET du
--    fichier supabase/migrations/029_provenance_phases_budget.sql ici.
--    (non recopié dans ce condensé pour rester lisible)


-- ╔══════════════════════════════════════════════════════════════╗
-- ║ 5 — OPÉRATIONS (à lancer après les migrations)               ║
-- ╚══════════════════════════════════════════════════════════════╝

-- 5a. Recharge le cache de schéma PostgREST → corrige l'erreur
--     "Could not find the 'budget_comment' column ... in the schema cache".
NOTIFY pgrst, 'reload schema';

-- 5b. S'assure que TON compte est administrateur et a un nom
--     (débloque : onglet validation budget, rejet de membres, apparition comme CDP).
--     ⚠️ Remplace l'email ci-dessous par le tien.
UPDATE public.personnes
SET profil_type_id = (SELECT id FROM public.profils_types WHERE slug = 'administrateur'),
    account_status = 'validated',
    prenom = COALESCE(NULLIF(prenom, ''), 'Baptiste'),
    nom    = COALESCE(NULLIF(nom, ''), 'Le Bec')
WHERE email = 'TON_EMAIL_ICI';

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

ALTER TABLE public.personnes
  ADD COLUMN IF NOT EXISTS ba_auto BOOLEAN NOT NULL DEFAULT true;

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
