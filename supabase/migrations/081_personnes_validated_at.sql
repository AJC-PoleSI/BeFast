-- 081_personnes_validated_at.sql
-- Date à laquelle un compte est passé à « validé ». Aucune colonne ne la
-- portait (audit_logs ne garde que les noms des champs modifiés) : le digest
-- hebdomadaire du Pôle RH ne pouvait donc pas compter « les comptes validés
-- cette semaine ».
--
-- Les comptes déjà validés avant cette migration restent à NULL : leur date
-- réelle est inconnue, le compteur n'est juste qu'à partir de l'application.
-- Rejouable.

ALTER TABLE public.personnes
  ADD COLUMN IF NOT EXISTS validated_at timestamptz;

CREATE OR REPLACE FUNCTION public.personnes_set_validated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.account_status = 'validated'
     AND (TG_OP = 'INSERT' OR OLD.account_status IS DISTINCT FROM 'validated') THEN
    NEW.validated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.personnes_set_validated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS personnes_set_validated_at ON public.personnes;
CREATE TRIGGER personnes_set_validated_at
  BEFORE INSERT OR UPDATE OF account_status ON public.personnes
  FOR EACH ROW EXECUTE FUNCTION public.personnes_set_validated_at();

-- Index partiel pour le comptage hebdomadaire.
CREATE INDEX IF NOT EXISTS idx_personnes_validated_at
  ON public.personnes (validated_at)
  WHERE validated_at IS NOT NULL;

NOTIFY pgrst, 'reload schema';
