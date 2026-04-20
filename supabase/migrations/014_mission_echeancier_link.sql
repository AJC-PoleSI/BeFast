-- Migration 014: fix missions schema + lien échéancier

-- Ajout des champs manquants sur missions
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS remuneration NUMERIC(10,2);

-- Ajout du lien mission -> bloc échéancier
ALTER TABLE public.echeancier_blocs
  ADD COLUMN IF NOT EXISTS mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE;

-- Colonnes manquantes sur candidatures (motivation + langues)
ALTER TABLE public.candidatures
  ADD COLUMN IF NOT EXISTS motivation TEXT,
  ADD COLUMN IF NOT EXISTS langues JSONB;

-- Index pour éviter les doublons de bloc par mission
CREATE UNIQUE INDEX IF NOT EXISTS echeancier_blocs_mission_idx
  ON public.echeancier_blocs(mission_id)
  WHERE mission_id IS NOT NULL;
