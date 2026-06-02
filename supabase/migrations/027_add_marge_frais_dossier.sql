-- Migration 027 : Ajout marge JE et frais de dossier sur les propositions

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS marge_je       NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frais_dossier  NUMERIC(10,2) DEFAULT 0;
