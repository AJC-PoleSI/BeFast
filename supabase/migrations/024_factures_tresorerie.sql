-- Migration 024: factures + suivi de paiement intervenants (Trésorerie)

-- ============================================================
-- FACTURES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.factures (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero           TEXT UNIQUE NOT NULL,
  nom              TEXT,
  etude_id         UUID REFERENCES public.etudes(id) ON DELETE SET NULL,
  bloc_id          UUID REFERENCES public.echeancier_blocs(id) ON DELETE SET NULL,
  montant_ht       NUMERIC(12,2) NOT NULL DEFAULT 0,
  date_emission    DATE,
  date_echeance    DATE,
  date_paiement    DATE,
  notes            TEXT,
  created_by       UUID REFERENCES public.personnes(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS factures_etude_id_idx ON public.factures(etude_id);
CREATE INDEX IF NOT EXISTS factures_bloc_id_idx ON public.factures(bloc_id);
CREATE INDEX IF NOT EXISTS factures_date_emission_idx ON public.factures(date_emission DESC);
CREATE INDEX IF NOT EXISTS factures_date_paiement_idx ON public.factures(date_paiement);

ALTER TABLE public.factures ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='factures' AND policyname='authenticated read factures') THEN
    CREATE POLICY "authenticated read factures" ON public.factures FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='factures' AND policyname='authenticated insert factures') THEN
    CREATE POLICY "authenticated insert factures" ON public.factures FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='factures' AND policyname='authenticated update factures') THEN
    CREATE POLICY "authenticated update factures" ON public.factures FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='factures' AND policyname='admin delete factures') THEN
    CREATE POLICY "admin delete factures" ON public.factures FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.personnes p JOIN public.profils_types pt ON pt.id = p.profil_type_id WHERE p.id = auth.uid() AND pt.slug = 'administrateur'));
  END IF;
END $$;

-- Trigger pour updated_at sur factures
CREATE OR REPLACE FUNCTION public.set_factures_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS factures_updated_at_trigger ON public.factures;
CREATE TRIGGER factures_updated_at_trigger
  BEFORE UPDATE ON public.factures
  FOR EACH ROW
  EXECUTE FUNCTION public.set_factures_updated_at();

-- ============================================================
-- MISSIONS : suivi paiement intervenant
-- ============================================================
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS date_paiement DATE,
  ADD COLUMN IF NOT EXISTS numero_bv TEXT;

CREATE INDEX IF NOT EXISTS missions_date_paiement_idx ON public.missions(date_paiement);
