-- 045_password_reset_token.sql
-- Pont « lien valable 72h » pour la campagne mot de passe.
-- Supabase plafonne l'expiration des liens recovery/OTP à 24h. Pour offrir un
-- lien de réinitialisation valable 72h, on émet un token custom (haute entropie)
-- dont seul le hash SHA-256 est stocké ici :
--   reset_token_hash       : SHA-256 du token brut envoyé dans le mail
--   reset_token_expires_at : expiration du lien (now + 72h à l'envoi)
-- À la validation du token (< 72h), le serveur génère à la volée une session
-- recovery Supabase (courte durée) pour permettre updateUser({ password }).

ALTER TABLE public.personnes
  ADD COLUMN IF NOT EXISTS reset_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS personnes_reset_token_hash_idx
  ON public.personnes (reset_token_hash)
  WHERE reset_token_hash IS NOT NULL;

NOTIFY pgrst, 'reload schema';
