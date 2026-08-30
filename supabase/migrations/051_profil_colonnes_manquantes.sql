-- Migration 051 : colonnes de `personnes` attendues par le code mais absentes
-- de la base réelle (héritage des migrations 023/035 jamais appliquées).
--
-- Symptômes constatés le 30/07/2026 :
--   - `avatar_url` : la route POST /api/profil/avatar uploadait bien le fichier
--     dans le bucket `avatars` puis échouait sur l'UPDATE → photo de profil
--     jamais conservée.
--   - `updated_at` : aucune trace de la dernière modification d'une fiche,
--     alors que toutes les autres tables du schéma en disposent.

ALTER TABLE public.personnes
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Horodatage automatique via la fonction déjà utilisée par le reste du schéma
-- (définie en 001_init_schema.sql).
DROP TRIGGER IF EXISTS personnes_updated_at ON public.personnes;
CREATE TRIGGER personnes_updated_at
  BEFORE UPDATE ON public.personnes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- PostgREST met son cache de schéma à jour (sinon les nouvelles colonnes
-- restent invisibles depuis l'API jusqu'au prochain redémarrage).
NOTIFY pgrst, 'reload schema';
