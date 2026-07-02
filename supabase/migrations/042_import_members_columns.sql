-- 042_import_members_columns.sql
-- Colonnes de reprise Be Quick + renommage du rôle membre_agc -> membre_ajc.

ALTER TABLE public.personnes
  ADD COLUMN IF NOT EXISTS legacy_bequick_id INTEGER,
  ADD COLUMN IF NOT EXISTS civilite TEXT,
  ADD COLUMN IF NOT EXISTS competences TEXT;

-- Idempotence de l'import : un legacy_bequick_id est unique (quand renseigné).
CREATE UNIQUE INDEX IF NOT EXISTS personnes_legacy_bequick_id_key
  ON public.personnes (legacy_bequick_id)
  WHERE legacy_bequick_id IS NOT NULL;

-- Renommage du rôle de base (slug + libellé). ancien_membre_agc inchangé.
UPDATE public.profils_types
  SET slug = 'membre_ajc', nom = 'Membre AJC'
  WHERE slug = 'membre_agc';

NOTIFY pgrst, 'reload schema';
