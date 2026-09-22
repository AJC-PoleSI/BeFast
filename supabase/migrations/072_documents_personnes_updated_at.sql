-- 072_documents_personnes_updated_at.sql
-- Le trigger `documents_personnes_updated_at` décrit par la migration 004
-- est absent de la base : `updated_at` gardait donc la date du tout premier
-- upload. Un membre qui remplace un justificatif refusé n'apparaissait pas
-- comme « mis à jour » dans la file de validation, qui trie sur cette colonne.
--
-- Rejouable.

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS documents_personnes_updated_at ON public.documents_personnes;
CREATE TRIGGER documents_personnes_updated_at
  BEFORE UPDATE ON public.documents_personnes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
