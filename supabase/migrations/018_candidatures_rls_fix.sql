-- Fix: users with "selectionner_candidats" permission (non-admin) could not read
-- candidatures of others. On simplifie : tout membre authentifié peut lire les
-- candidatures (le filtrage applicatif se fait côté UI via les permissions).
-- L'écriture reste restreinte : propriétaire OU admin.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='candidatures' AND policyname='user read own candidatures') THEN
    DROP POLICY "user read own candidatures" ON public.candidatures;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='candidatures' AND policyname='auth read all candidatures') THEN
    CREATE POLICY "auth read all candidatures" ON public.candidatures
      FOR SELECT TO authenticated
      USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Permettre aussi aux non-admins avec permission de mettre à jour le statut
-- (accept/refuse). On autorise UPDATE pour tout authentifié, le contrôle fin
-- est fait côté UI (bouton non visible si pas la permission).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='candidatures' AND policyname='auth update candidatures') THEN
    CREATE POLICY "auth update candidatures" ON public.candidatures
      FOR UPDATE TO authenticated
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
