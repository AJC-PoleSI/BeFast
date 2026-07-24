-- ════════════════════════════════════════════════════════════════════════
-- 044 — Intégration Befast ↔ RH Manager (côté Befast — projet rslzt…, MAÎTRE)
-- Befast est la source de vérité de l'identité et des documents candidats.
-- Ajoute : rôle `candidat` cloisonné, colonnes candidat sur personnes,
-- table de liaison account_links.
-- Idempotent.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Rôle « candidat » : portail cloisonné, aucune permission interne.
-- categorie='base' (contrainte profils_types_categorie_check : 'base'|'bureau'|'pole').
INSERT INTO public.profils_types (nom, slug, permissions, est_defaut, categorie)
VALUES ('Candidat', 'candidat', '{}'::jsonb, false, 'base')
ON CONFLICT (slug) DO NOTHING;

-- 2. Colonnes candidat sur personnes.
ALTER TABLE public.personnes
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS rh_candidate_id uuid,
  ADD COLUMN IF NOT EXISTS is_candidate boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS documents_complete boolean NOT NULL DEFAULT false;

-- 3. Table de liaison (email = clé). Détenue par Befast (maître).
CREATE TABLE IF NOT EXISTS public.account_links (
  email              text PRIMARY KEY,
  befast_person_id   uuid REFERENCES public.personnes(id) ON DELETE SET NULL,
  rh_candidate_id    uuid,
  documents_complete boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_links_befast_person_id_idx
  ON public.account_links (befast_person_id);

-- 4. RLS : account_links n'est jamais exposée au client (service-role only).
ALTER TABLE public.account_links ENABLE ROW LEVEL SECURITY;
-- (aucune policy => seul le service-role y accède ; les API internes l'utilisent)

-- 5. maj updated_at
CREATE OR REPLACE FUNCTION public.touch_account_links_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_account_links_updated_at ON public.account_links;
CREATE TRIGGER trg_account_links_updated_at
  BEFORE UPDATE ON public.account_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_account_links_updated_at();
