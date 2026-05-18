-- Migration 027 : type de facture (acompte / intermediaire / solde)
-- Permet de distinguer les 3 types de factures pour la génération de docs.

ALTER TABLE public.factures
  ADD COLUMN IF NOT EXISTS type TEXT
    CHECK (type IS NULL OR type IN ('acompte', 'intermediaire', 'solde')),
  ADD COLUMN IF NOT EXISTS reference_avenant TEXT;

CREATE INDEX IF NOT EXISTS factures_type_idx ON public.factures(etude_id, type);
