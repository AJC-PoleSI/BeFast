-- Add missing column reponse_date to candidatures
ALTER TABLE public.candidatures
  ADD COLUMN IF NOT EXISTS reponse_date TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
