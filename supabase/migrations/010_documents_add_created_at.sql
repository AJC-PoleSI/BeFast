-- ============================================================
-- 010_documents_add_created_at.sql
-- Production table is missing `created_at` on documents_personnes.
-- Add it and backfill from updated_at.
-- ============================================================

ALTER TABLE public.documents_personnes
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- Backfill existing rows
UPDATE public.documents_personnes
SET created_at = COALESCE(created_at, updated_at, now())
WHERE created_at IS NULL;

-- Lock default + NOT NULL going forward
ALTER TABLE public.documents_personnes
ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.documents_personnes
ALTER COLUMN created_at SET NOT NULL;
