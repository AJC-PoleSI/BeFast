-- Migration 008: Add account_status to personnes

ALTER TABLE public.personnes
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'pending_validation'
    CHECK (account_status IN ('pending_validation', 'validated'));
