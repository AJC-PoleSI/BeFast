-- ============================================================
-- Migration 032 : Archivage des phases + Super-administrateur
-- ============================================================

-- 1. SUPER-ADMINISTRATEUR
-- Un super-admin reste un admin normal + quelques pouvoirs sensibles
-- (archivage de phases, etc.). Booléen sur la personne.
ALTER TABLE public.personnes
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- 2. ARCHIVAGE DES PHASES PAR DÉFAUT (jamais de suppression dure)
-- Archiver retire la phase du catalogue du générateur sans casser les
-- études existantes (qui référencent la phase par son TEXTE, pas par FK).
ALTER TABLE public.phases_defaut
  ADD COLUMN IF NOT EXISTS archived    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES public.personnes(id) ON DELETE SET NULL,
  -- 'manuel' = créée à la main ; 'auto' = détectée depuis une propale (point 5)
  ADD COLUMN IF NOT EXISTS source      TEXT NOT NULL DEFAULT 'manuel';

CREATE INDEX IF NOT EXISTS phases_defaut_archived_idx ON public.phases_defaut(archived);
