-- ============================================================
-- Migration 028 : Marges recommandées par taille d'entreprise
-- Le générateur de propales remplace la case "micro-entrepreneur"
-- par un choix de taille de structure ; chaque taille porte une
-- marge JE recommandée, pilotable depuis "Contrôle des données".
-- ============================================================

-- Garantit la présence de la colonne taille_entreprise sur proposals
-- (alignement avec le formulaire, indépendamment de l'état de la 026).
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS taille_entreprise TEXT;

-- Table de pilotage : 1 taille -> 1 marge recommandée (%).
CREATE TABLE IF NOT EXISTS public.marges_recommandees (
  taille_entreprise TEXT PRIMARY KEY,
  marge_pct         NUMERIC(5,2) NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.marges_recommandees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read marges" ON public.marges_recommandees;
CREATE POLICY "public read marges" ON public.marges_recommandees
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin write marges" ON public.marges_recommandees;
CREATE POLICY "admin write marges" ON public.marges_recommandees
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.personnes p JOIN public.profils_types pt ON pt.id = p.profil_type_id WHERE p.id = auth.uid() AND pt.slug = 'administrateur'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.personnes p JOIN public.profils_types pt ON pt.id = p.profil_type_id WHERE p.id = auth.uid() AND pt.slug = 'administrateur'));

-- Valeurs par défaut (modifiables ensuite depuis l'interface).
INSERT INTO public.marges_recommandees (taille_entreprise, marge_pct) VALUES
  ('microentreprise',   5),
  ('petite entreprise', 8),
  ('PME',               10),
  ('ETI',               12),
  ('grand groupe',      15)
ON CONFLICT (taille_entreprise) DO NOTHING;
