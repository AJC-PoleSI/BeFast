-- 043_password_campaign.sql
-- Suivi de la campagne « définir mon mot de passe » pour les comptes migrés :
--   password_setup_sent_at : horodatage de l'envoi du mail
--   password_set_at        : horodatage de la définition du mot de passe

ALTER TABLE public.personnes
  ADD COLUMN IF NOT EXISTS password_setup_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
