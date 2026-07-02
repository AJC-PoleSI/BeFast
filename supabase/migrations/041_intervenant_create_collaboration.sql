-- 041_intervenant_create_collaboration.sql
-- Corrige : l'intervenant assigné à une mission ne pouvait pas créer sa propre
-- ligne mission_collaborations (seule la policy chef_projet le permettait),
-- ce qui bloquait silencieusement (RLS) l'auto-création côté client dans
-- /missions/[missionId]/interne et affichait à tort "Un intervenant doit
-- être assigné" alors qu'il l'était bien.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mission_collaborations' AND policyname='intervenant create mission_collaborations') THEN
    CREATE POLICY "intervenant create mission_collaborations" ON public.mission_collaborations FOR INSERT TO authenticated
      WITH CHECK (
        intervenant_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.missions m
          WHERE m.id = mission_id AND m.intervenant_id = auth.uid()
        )
      );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
