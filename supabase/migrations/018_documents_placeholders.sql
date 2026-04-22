-- Migration 018: Add missing fields for document placeholders
ALTER TABLE public.etudes
  ADD COLUMN IF NOT EXISTS ref TEXT,
  ADD COLUMN IF NOT EXISTS objectif TEXT,
  ADD COLUMN IF NOT EXISTS duree_semaine INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS date_signature DATE,
  ADD COLUMN IF NOT EXISTS reference_convention_client TEXT,
  ADD COLUMN IF NOT EXISTS reference_avant_projet TEXT,
  ADD COLUMN IF NOT EXISTS reference_dernier_avenant TEXT,
  ADD COLUMN IF NOT EXISTS reference_convention_etude TEXT;

ALTER TABLE public.echeancier_blocs
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS prix_jeh NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS nombre_jeh NUMERIC(6,1) DEFAULT 0;

NOTIFY pgrst, 'reload schema';
