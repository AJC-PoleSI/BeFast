-- Migration 025: lignes de facture (montant par phase + frais)
-- Permet de facturer un % d'acompte sur chaque phase de l'échéancier
-- + une ligne "Frais" pour les frais de dossier.

CREATE TABLE IF NOT EXISTS public.facture_lignes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id       UUID NOT NULL REFERENCES public.factures(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('phase', 'frais')),
  bloc_id          UUID REFERENCES public.echeancier_blocs(id) ON DELETE SET NULL,
  libelle          TEXT NOT NULL,
  montant_total    NUMERIC(12,2) NOT NULL DEFAULT 0,   -- montant total de la phase/frais (référence)
  montant          NUMERIC(12,2) NOT NULL DEFAULT 0,   -- montant facturé sur cette facture
  pourcentage      NUMERIC(5,2) NOT NULL DEFAULT 0,    -- % du montant_total facturé ici
  ordre            INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS facture_lignes_facture_id_idx ON public.facture_lignes(facture_id);
CREATE INDEX IF NOT EXISTS facture_lignes_bloc_id_idx ON public.facture_lignes(bloc_id);

ALTER TABLE public.facture_lignes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='facture_lignes' AND policyname='authenticated read facture_lignes') THEN
    CREATE POLICY "authenticated read facture_lignes" ON public.facture_lignes FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='facture_lignes' AND policyname='authenticated insert facture_lignes') THEN
    CREATE POLICY "authenticated insert facture_lignes" ON public.facture_lignes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='facture_lignes' AND policyname='authenticated update facture_lignes') THEN
    CREATE POLICY "authenticated update facture_lignes" ON public.facture_lignes FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='facture_lignes' AND policyname='authenticated delete facture_lignes') THEN
    CREATE POLICY "authenticated delete facture_lignes" ON public.facture_lignes FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Recalcule automatiquement le montant_ht de la facture quand ses lignes changent
CREATE OR REPLACE FUNCTION public.recalc_facture_montant()
RETURNS TRIGGER AS $$
DECLARE
  f_id UUID;
  total NUMERIC(12,2);
BEGIN
  f_id := COALESCE(NEW.facture_id, OLD.facture_id);
  SELECT COALESCE(SUM(montant), 0) INTO total
  FROM public.facture_lignes WHERE facture_id = f_id;
  UPDATE public.factures SET montant_ht = total, updated_at = now() WHERE id = f_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS facture_lignes_recalc_trigger ON public.facture_lignes;
CREATE TRIGGER facture_lignes_recalc_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.facture_lignes
  FOR EACH ROW
  EXECUTE FUNCTION public.recalc_facture_montant();

-- Ajoute une colonne "numero_dans_etude" sur factures pour afficher "Facture #1, #2, …"
ALTER TABLE public.factures
  ADD COLUMN IF NOT EXISTS numero_dans_etude INTEGER;

CREATE INDEX IF NOT EXISTS factures_numero_dans_etude_idx ON public.factures(etude_id, numero_dans_etude);
