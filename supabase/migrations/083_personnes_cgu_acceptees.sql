-- 083_personnes_cgu_acceptees.sql
-- Preuve d'acceptation des CGU de BeFast : version acceptée + horodatage.
-- Kiwi Légal : la preuve datée du recueil du consentement et des mentions
-- d'information se conserve 5 ans.
--
-- Les comptes existants restent à NULL : ils n'ont jamais accepté de CGU. Leur
-- acceptation sera recueillie à la connexion (chantier distinct).
-- Les colonnes ne sont écrites que par le serveur (service_role) : un
-- utilisateur connecté ne peut pas se fabriquer ou effacer sa preuve.
-- Rejouable.

ALTER TABLE public.personnes
  ADD COLUMN IF NOT EXISTS cgu_version text,
  ADD COLUMN IF NOT EXISTS cgu_accepted_at timestamptz;

CREATE OR REPLACE FUNCTION public.personnes_proteger_cgu()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    NEW.cgu_version = OLD.cgu_version;
    NEW.cgu_accepted_at = OLD.cgu_accepted_at;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.personnes_proteger_cgu() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS personnes_proteger_cgu ON public.personnes;
CREATE TRIGGER personnes_proteger_cgu
  BEFORE UPDATE OF cgu_version, cgu_accepted_at ON public.personnes
  FOR EACH ROW EXECUTE FUNCTION public.personnes_proteger_cgu();

NOTIFY pgrst, 'reload schema';
