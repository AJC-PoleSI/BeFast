-- Add type to etudes
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('ao','cs','prospection'));

-- Add budget_ht to etudes (budget becomes TTC)
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS budget_ht NUMERIC(12,2);

-- Global parametres table
CREATE TABLE IF NOT EXISTS public.parametres (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.parametres ENABLE ROW LEVEL SECURITY;
-- Everyone can read
CREATE POLICY "public read parametres" ON public.parametres FOR SELECT TO authenticated USING (true);
-- Only admin can write
CREATE POLICY "admin write parametres" ON public.parametres FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.personnes p JOIN public.profils_types pt ON pt.id=p.profil_type_id WHERE p.id=auth.uid() AND pt.slug='administrateur'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.personnes p JOIN public.profils_types pt ON pt.id=p.profil_type_id WHERE p.id=auth.uid() AND pt.slug='administrateur'));

-- Default TVA rate 20%
INSERT INTO public.parametres (key, value) VALUES ('tva_rate', '20') ON CONFLICT DO NOTHING;
