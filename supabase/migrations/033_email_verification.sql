-- Migration 033: Email verification layer (custom token via Resend)
-- Separate concern from admin validation (account_status). A new account must
-- (1) verify its email, then (2) be validated by an administrator.

ALTER TABLE public.personnes
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMPTZ;

-- Grandfather every existing account so the new gate never locks anyone out.
-- Only brand-new signups (inserted after this migration via handle_new_user)
-- start with email_verified = false.
UPDATE public.personnes SET email_verified = true WHERE email_verified = false;

-- Token lookup happens by hash (the raw token is never stored).
CREATE INDEX IF NOT EXISTS idx_personnes_verification_token_hash
  ON public.personnes (verification_token_hash);

NOTIFY pgrst, 'reload schema';
