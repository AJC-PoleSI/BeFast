-- Migration 016: tarification des études (frais de dossier + marge) + index de perf

ALTER TABLE public.etudes
  ADD COLUMN IF NOT EXISTS frais_dossier NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS marge_pct NUMERIC(5,2) DEFAULT 0;

-- Index de performance pour accélérer les listes / filtres
CREATE INDEX IF NOT EXISTS etudes_published_idx ON public.etudes(published);
CREATE INDEX IF NOT EXISTS etudes_statut_idx ON public.etudes(statut);
CREATE INDEX IF NOT EXISTS etudes_created_at_idx ON public.etudes(created_at DESC);

CREATE INDEX IF NOT EXISTS missions_published_idx ON public.missions(published);
CREATE INDEX IF NOT EXISTS missions_statut_idx ON public.missions(statut);
CREATE INDEX IF NOT EXISTS missions_etude_id_idx ON public.missions(etude_id);
CREATE INDEX IF NOT EXISTS missions_created_at_idx ON public.missions(created_at DESC);

CREATE INDEX IF NOT EXISTS echeancier_blocs_etude_id_idx ON public.echeancier_blocs(etude_id);
CREATE INDEX IF NOT EXISTS candidatures_mission_id_idx ON public.candidatures(mission_id);
CREATE INDEX IF NOT EXISTS candidatures_personne_id_idx ON public.candidatures(personne_id);

-- Paramètre tarif JEH unitaire (utilisé par défaut si non défini sur l'étude)
INSERT INTO public.parametres(key, value)
VALUES ('tarif_jeh_default', '450')
ON CONFLICT (key) DO NOTHING;
