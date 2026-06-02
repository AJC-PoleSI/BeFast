-- ============================================================
-- Migration 026 : MODULE PROPOSITIONS (fusion dans la base BeFast)
-- Remplace les mocks JSON / localStorage du prototype par de vraies
-- tables Supabase référençant les clients et personnes réels.
-- À la signature d'une CE, une Étude réelle est créée (voir signProposal).
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROPOSITIONS COMMERCIALES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.proposals (
  id                   VARCHAR(50) PRIMARY KEY,                       -- ID lisible ex: "JDU-20260602-1042"
  status               TEXT NOT NULL DEFAULT 'envoyée'
                         CHECK (status IN ('envoyée','validée','refusée','CE éditée','CE signée')),

  -- Chef de projet = membre AJC réel (personne validée)
  cdp_id               UUID REFERENCES public.personnes(id) ON DELETE SET NULL,
  cdp_custom           TEXT,                                          -- saisie manuelle éventuelle

  -- Client : référence réelle optionnelle + champs libres (saisie rapide)
  client_id            UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_company       TEXT,
  is_autoentrepreneur  BOOLEAN DEFAULT false,
  client_civilite      TEXT,
  client_first_name    TEXT,
  client_last_name     TEXT,
  client_email         TEXT,
  client_phone         TEXT,

  -- Informations de base
  study_type           TEXT,
  start_date           DATE,
  global_frais_annexes NUMERIC(10,2) DEFAULT 0,
  suivi_jeh_count      INTEGER DEFAULT 1,
  suivi_jeh_price      NUMERIC(10,2) DEFAULT 100,
  total_ht             NUMERIC(10,2) DEFAULT 0,
  total_ttc            NUMERIC(10,2) DEFAULT 0,

  -- Contexte
  context_situation    TEXT,
  context_intervention TEXT,
  context_enjeu        TEXT,

  -- Cahier des charges
  cdc_objectifs        TEXT,
  cdc_contraintes      TEXT,
  cdc_livrables        TEXT,

  -- Lien vers l'Étude créée à la signature de la CE
  etude_id             UUID REFERENCES public.etudes(id) ON DELETE SET NULL,
  signed_at            TIMESTAMPTZ,

  created_by           UUID REFERENCES public.personnes(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 2. PHASES D'UNE PROPOSITION (1..N)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.proposal_phases (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id          VARCHAR(50) NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  order_index          INTEGER NOT NULL DEFAULT 0,

  name                 TEXT NOT NULL,
  objectifs            TEXT,
  methodologie         TEXT,
  contraintes          TEXT,

  -- Échéancier (semaine_debut permet le Gantt éditable, calqué sur echeancier_blocs)
  duree_semaines       INTEGER DEFAULT 1,
  semaine_debut        INTEGER DEFAULT 1,

  -- Intervenants
  intervenants_count   NUMERIC(5,1) DEFAULT 1,
  intervenants_niveau  TEXT,

  -- Budget
  jeh_count            INTEGER DEFAULT 1,
  jeh_price            NUMERIC(10,2) DEFAULT 100
);

CREATE INDEX IF NOT EXISTS proposal_phases_proposal_idx ON public.proposal_phases(proposal_id);
CREATE INDEX IF NOT EXISTS proposals_status_idx ON public.proposals(status);
CREATE INDEX IF NOT EXISTS proposals_etude_idx ON public.proposals(etude_id);

-- ------------------------------------------------------------
-- 3. RLS (mêmes règles que clients/etudes/missions : migration 005)
-- ------------------------------------------------------------
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_phases ENABLE ROW LEVEL SECURITY;

-- proposals : lecture/écriture pour tout membre authentifié, suppression admin
DROP POLICY IF EXISTS "proposals read"   ON public.proposals;
DROP POLICY IF EXISTS "proposals insert" ON public.proposals;
DROP POLICY IF EXISTS "proposals update" ON public.proposals;
DROP POLICY IF EXISTS "proposals delete" ON public.proposals;

CREATE POLICY "proposals read"   ON public.proposals FOR SELECT TO authenticated USING (true);
CREATE POLICY "proposals insert" ON public.proposals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "proposals update" ON public.proposals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "proposals delete" ON public.proposals FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.personnes p JOIN public.profils_types pt ON pt.id = p.profil_type_id WHERE p.id = auth.uid() AND pt.slug = 'administrateur'));

-- proposal_phases : gérées par tout membre authentifié
DROP POLICY IF EXISTS "proposal_phases all" ON public.proposal_phases;
CREATE POLICY "proposal_phases all" ON public.proposal_phases FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- 4. ALIGNEMENT DU CHECK STATUT DES ÉTUDES
-- L'UID utilise prospection / en_cours_prospection / signee / en_cours / terminee
-- alors que la migration 005 ne couvrait que prospect/en_cours/terminee/annulee.
-- On élargit la contrainte pour éviter tout échec d'insertion (drift de schéma).
-- ------------------------------------------------------------
ALTER TABLE public.etudes DROP CONSTRAINT IF EXISTS etudes_statut_check;
ALTER TABLE public.etudes ADD CONSTRAINT etudes_statut_check
  CHECK (statut IN ('prospect','prospection','en_cours_prospection','signee','en_cours','terminee','annulee'));
