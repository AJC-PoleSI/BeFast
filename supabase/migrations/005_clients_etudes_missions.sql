-- Migration 005: clients, etudes, missions, candidatures

-- ============================================================
-- CLIENTS
-- ============================================================
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  email TEXT,
  telephone TEXT,
  type TEXT NOT NULL CHECK (type IN ('ao', 'cs', 'prospection')),
  notes TEXT,
  created_by UUID REFERENCES public.personnes(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read clients"
  ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "agc members manage clients"
  ON public.clients FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.personnes p
      JOIN public.profils_types pt ON pt.id = p.profil_type_id
      WHERE p.id = auth.uid() AND pt.slug IN ('membre_agc', 'administrateur')
    )
  );

CREATE TRIGGER clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- ETUDES
-- ============================================================
CREATE TABLE public.etudes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  numero TEXT NOT NULL UNIQUE,
  client_id UUID REFERENCES public.clients(id),
  suiveur_id UUID REFERENCES public.personnes(id),
  budget NUMERIC(12, 2),
  commentaire TEXT,
  statut TEXT NOT NULL DEFAULT 'prospection'
    CHECK (statut IN ('prospection', 'en_cours_prospection', 'signee', 'en_cours', 'terminee')),
  created_by UUID REFERENCES public.personnes(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.etudes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read etudes"
  ON public.etudes FOR SELECT TO authenticated USING (true);
CREATE POLICY "agc members manage etudes"
  ON public.etudes FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.personnes p
      JOIN public.profils_types pt ON pt.id = p.profil_type_id
      WHERE p.id = auth.uid() AND pt.slug IN ('membre_agc', 'administrateur')
    )
  );

CREATE TRIGGER etudes_updated_at BEFORE UPDATE ON public.etudes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- MISSIONS
-- ============================================================
CREATE TABLE public.missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etude_id UUID REFERENCES public.etudes(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('chef_projet', 'intervenant')),
  voie TEXT CHECK (voie IN ('finance', 'marketing', 'audit', 'rse')),
  classe TEXT CHECK (classe IN ('premaster', 'm1', 'm2')),
  langues TEXT[] DEFAULT '{}',
  date_debut DATE,
  date_fin DATE,
  remuneration NUMERIC(10, 2),
  nb_jeh INTEGER DEFAULT 0,
  nb_intervenants INTEGER DEFAULT 1,
  statut TEXT NOT NULL DEFAULT 'ouverte'
    CHECK (statut IN ('ouverte', 'pourvue', 'terminee', 'annulee')),
  created_by UUID REFERENCES public.personnes(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read missions"
  ON public.missions FOR SELECT TO authenticated USING (true);
CREATE POLICY "agc members manage missions"
  ON public.missions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.personnes p
      JOIN public.profils_types pt ON pt.id = p.profil_type_id
      WHERE p.id = auth.uid() AND pt.slug IN ('membre_agc', 'administrateur')
    )
  );

CREATE TRIGGER missions_updated_at BEFORE UPDATE ON public.missions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- CANDIDATURES
-- ============================================================
CREATE TABLE public.candidatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  personne_id UUID NOT NULL REFERENCES public.personnes(id) ON DELETE CASCADE,
  motivation TEXT NOT NULL,
  classe TEXT CHECK (classe IN ('premaster', 'm1', 'm2')),
  langues JSONB DEFAULT '[]'::jsonb,
  statut TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente', 'acceptee', 'refusee')),
  reponse_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(mission_id, personne_id)
);

ALTER TABLE public.candidatures ENABLE ROW LEVEL SECURITY;

-- Users can read their own candidatures
CREATE POLICY "users read own candidatures"
  ON public.candidatures FOR SELECT TO authenticated
  USING (auth.uid() = personne_id);

-- Users can insert their own candidatures
CREATE POLICY "users insert own candidatures"
  ON public.candidatures FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = personne_id);

-- AGC members can read all candidatures
CREATE POLICY "agc read all candidatures"
  ON public.candidatures FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.personnes p
      JOIN public.profils_types pt ON pt.id = p.profil_type_id
      WHERE p.id = auth.uid() AND pt.slug IN ('membre_agc', 'administrateur')
    )
  );

-- AGC members can update candidatures (accept/reject)
CREATE POLICY "agc update candidatures"
  ON public.candidatures FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.personnes p
      JOIN public.profils_types pt ON pt.id = p.profil_type_id
      WHERE p.id = auth.uid() AND pt.slug IN ('membre_agc', 'administrateur')
    )
  );

CREATE TRIGGER candidatures_updated_at BEFORE UPDATE ON public.candidatures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- ECHEANCIER BLOCKS (for Gantt)
-- ============================================================
CREATE TABLE public.echeancier_blocs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etude_id UUID NOT NULL REFERENCES public.etudes(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  semaine_debut INTEGER NOT NULL DEFAULT 1,
  duree_semaines INTEGER NOT NULL DEFAULT 1,
  jeh INTEGER DEFAULT 0,
  couleur TEXT DEFAULT '#C9A84C',
  ordre INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.echeancier_blocs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read echeancier"
  ON public.echeancier_blocs FOR SELECT TO authenticated USING (true);
CREATE POLICY "agc manage echeancier"
  ON public.echeancier_blocs FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.personnes p
      JOIN public.profils_types pt ON pt.id = p.profil_type_id
      WHERE p.id = auth.uid() AND pt.slug IN ('membre_agc', 'administrateur')
    )
  );

CREATE TRIGGER echeancier_blocs_updated_at BEFORE UPDATE ON public.echeancier_blocs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
