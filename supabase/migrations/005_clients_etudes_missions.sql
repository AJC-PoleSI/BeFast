-- Migration 005: clients, etudes, missions, candidatures, echeancier_blocs

-- ============================================================
-- CLIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom         TEXT NOT NULL,
  secteur     TEXT,
  contact_nom TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  type        TEXT CHECK (type IN ('ao','cs','prospection')),
  actif       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='clients' AND policyname='authenticated read clients') THEN
    CREATE POLICY "authenticated read clients" ON public.clients FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='clients' AND policyname='admin manage clients') THEN
    CREATE POLICY "admin manage clients" ON public.clients FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.personnes p JOIN public.profils_types pt ON pt.id = p.profil_type_id WHERE p.id = auth.uid() AND pt.slug = 'administrateur'))
      WITH CHECK (EXISTS (SELECT 1 FROM public.personnes p JOIN public.profils_types pt ON pt.id = p.profil_type_id WHERE p.id = auth.uid() AND pt.slug = 'administrateur'));
  END IF;
END $$;

-- ============================================================
-- ETUDES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.etudes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero      TEXT UNIQUE,
  nom         TEXT NOT NULL,
  client_id   UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  suiveur_id  UUID REFERENCES public.personnes(id) ON DELETE SET NULL,
  statut      TEXT NOT NULL DEFAULT 'prospect' CHECK (statut IN ('prospect','en_cours','terminee','annulee')),
  type        TEXT CHECK (type IN ('ao','cs','prospection')),
  budget_ht   NUMERIC(12,2),
  description TEXT,
  date_debut  DATE,
  date_fin    DATE,
  created_by  UUID REFERENCES public.personnes(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.etudes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='etudes' AND policyname='authenticated read etudes') THEN
    CREATE POLICY "authenticated read etudes" ON public.etudes FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='etudes' AND policyname='authenticated insert etudes') THEN
    CREATE POLICY "authenticated insert etudes" ON public.etudes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='etudes' AND policyname='authenticated update etudes') THEN
    CREATE POLICY "authenticated update etudes" ON public.etudes FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='etudes' AND policyname='admin delete etudes') THEN
    CREATE POLICY "admin delete etudes" ON public.etudes FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.personnes p JOIN public.profils_types pt ON pt.id = p.profil_type_id WHERE p.id = auth.uid() AND pt.slug = 'administrateur'));
  END IF;
END $$;

-- ============================================================
-- MISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.missions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etude_id    UUID NOT NULL REFERENCES public.etudes(id) ON DELETE CASCADE,
  nom         TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'intervenant' CHECK (type IN ('chef_projet','intervenant')),
  voie        TEXT CHECK (voie IN ('finance','marketing','audit','rse')),
  classe      TEXT CHECK (classe IN ('premaster','m1','m2')),
  description TEXT,
  nb_jours    NUMERIC(6,1),
  taux_jour   NUMERIC(10,2),
  date_debut  DATE,
  date_fin    DATE,
  statut      TEXT NOT NULL DEFAULT 'ouverte' CHECK (statut IN ('ouverte','pourvue','terminee','annulee')),
  intervenant_id UUID REFERENCES public.personnes(id) ON DELETE SET NULL,
  created_by  UUID REFERENCES public.personnes(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='missions' AND policyname='authenticated read missions') THEN
    CREATE POLICY "authenticated read missions" ON public.missions FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='missions' AND policyname='authenticated write missions') THEN
    CREATE POLICY "authenticated write missions" ON public.missions FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- ============================================================
-- CANDIDATURES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.candidatures (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id  UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  personne_id UUID NOT NULL REFERENCES public.personnes(id) ON DELETE CASCADE,
  classe      TEXT CHECK (classe IN ('premaster','m1','m2')),
  message     TEXT,
  statut      TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente','acceptee','refusee')),
  created_by  UUID REFERENCES public.personnes(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(mission_id, personne_id)
);

ALTER TABLE public.candidatures ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='candidatures' AND policyname='user read own candidatures') THEN
    CREATE POLICY "user read own candidatures" ON public.candidatures FOR SELECT TO authenticated
      USING (personne_id = auth.uid() OR EXISTS (SELECT 1 FROM public.personnes p JOIN public.profils_types pt ON pt.id = p.profil_type_id WHERE p.id = auth.uid() AND pt.slug = 'administrateur'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='candidatures' AND policyname='user manage own candidatures') THEN
    CREATE POLICY "user manage own candidatures" ON public.candidatures FOR ALL TO authenticated
      USING (personne_id = auth.uid()) WITH CHECK (personne_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='candidatures' AND policyname='admin manage candidatures') THEN
    CREATE POLICY "admin manage candidatures" ON public.candidatures FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.personnes p JOIN public.profils_types pt ON pt.id = p.profil_type_id WHERE p.id = auth.uid() AND pt.slug = 'administrateur'))
      WITH CHECK (EXISTS (SELECT 1 FROM public.personnes p JOIN public.profils_types pt ON pt.id = p.profil_type_id WHERE p.id = auth.uid() AND pt.slug = 'administrateur'));
  END IF;
END $$;

-- ============================================================
-- ECHEANCIER BLOCS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.echeancier_blocs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etude_id    UUID NOT NULL REFERENCES public.etudes(id) ON DELETE CASCADE,
  nom         TEXT NOT NULL,
  semaine_debut INTEGER NOT NULL DEFAULT 1,
  duree_semaines INTEGER NOT NULL DEFAULT 1,
  couleur     TEXT DEFAULT '#00236f',
  ordre       INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.echeancier_blocs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='echeancier_blocs' AND policyname='authenticated manage blocs') THEN
    CREATE POLICY "authenticated manage blocs" ON public.echeancier_blocs FOR ALL TO authenticated
      USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
