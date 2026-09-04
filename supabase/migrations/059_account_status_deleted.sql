-- Migration 059 : statut « deleted » pour les comptes supprimés.
--
-- La contrainte posée par MIGRATIONS_A_APPLIQUER.sql n'autorisait que
-- pending_validation / validated / rejected. Un compte supprimé n'efface pas
-- sa ligne `personnes` : notes_de_frais, mission_collaborations et
-- candidatures cascadent depuis elle (migrations 005 et 025), et personnes.id
-- cascade lui-même depuis auth.users. La ligne est donc vidée de ses données
-- personnelles et marquée `deleted`, ce qui coupe l'accès via la garde de
-- app/(dashboard)/layout.tsx.

ALTER TABLE public.personnes DROP CONSTRAINT IF EXISTS personnes_account_status_check;

ALTER TABLE public.personnes ADD CONSTRAINT personnes_account_status_check
  CHECK (account_status IN ('pending_validation', 'validated', 'rejected', 'deleted'));
