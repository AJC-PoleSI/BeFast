-- Migration 021: Restore missing columns to personnes table
ALTER TABLE public.personnes
  ADD COLUMN IF NOT EXISTS portable TEXT,
  ADD COLUMN IF NOT EXISTS promo TEXT,
  ADD COLUMN IF NOT EXISTS adresse TEXT,
  ADD COLUMN IF NOT EXISTS ville TEXT,
  ADD COLUMN IF NOT EXISTS code_postal TEXT,
  ADD COLUMN IF NOT EXISTS pole TEXT,
  ADD COLUMN IF NOT EXISTS etablissement TEXT,
  ADD COLUMN IF NOT EXISTS scolarite TEXT,
  ADD COLUMN IF NOT EXISTS date_naissance DATE,
  ADD COLUMN IF NOT EXISTS nss_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS iban_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS encryption_key_version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS actif BOOLEAN NOT NULL DEFAULT true;

-- Ensure account_status has the correct default
ALTER TABLE public.personnes 
  ALTER COLUMN account_status SET DEFAULT 'pending_validation';

NOTIFY pgrst, 'reload schema';
