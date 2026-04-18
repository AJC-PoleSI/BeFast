-- ============================================================
-- 011_admin_read_all_personnes.sql
-- Allow admins (and users with voir_documents_membres) to read any personne row
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'personnes'
      AND policyname = 'admin read all personnes'
  ) THEN
    CREATE POLICY "admin read all personnes"
      ON public.personnes FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.personnes p
          JOIN public.profils_types pt ON pt.id = p.profil_type_id
          WHERE p.id = auth.uid()
            AND (
              pt.slug = 'administrateur'
              OR (pt.permissions->>'voir_documents_membres')::boolean = true
            )
        )
      );
  END IF;
END $$;
