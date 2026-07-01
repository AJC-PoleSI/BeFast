-- 039_roles_postes.sql
-- Sous-rôles AJC : postes (bureau/pôles) cumulés au rôle de base d'une personne.
-- Permissions effectives = rôle_base.permissions ∪ union(postes.permissions).

-- 1) Catégorie sur profils_types : 'base' (rôle unique via personnes.profil_type_id)
--    vs 'bureau'/'pole' (postes cumulables via personne_postes).
ALTER TABLE public.profils_types
  ADD COLUMN IF NOT EXISTS categorie TEXT NOT NULL DEFAULT 'base';

ALTER TABLE public.profils_types
  DROP CONSTRAINT IF EXISTS profils_types_categorie_check;
ALTER TABLE public.profils_types
  ADD CONSTRAINT profils_types_categorie_check
  CHECK (categorie IN ('base','bureau','pole'));

-- 2) Table de liaison personne <-> poste (cumul de plusieurs postes).
CREATE TABLE IF NOT EXISTS public.personne_postes (
  personne_id UUID NOT NULL REFERENCES public.personnes(id) ON DELETE CASCADE,
  poste_id    UUID NOT NULL REFERENCES public.profils_types(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (personne_id, poste_id)
);

ALTER TABLE public.personne_postes ENABLE ROW LEVEL SECURITY;

-- Lecture : l'intéressé voit ses postes ; les admins voient tout.
DROP POLICY IF EXISTS "personne_postes_select" ON public.personne_postes;
CREATE POLICY "personne_postes_select" ON public.personne_postes
  FOR SELECT USING (
    personne_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.personnes p
      JOIN public.profils_types pt ON pt.id = p.profil_type_id
      WHERE p.id = auth.uid() AND pt.slug = 'administrateur'
    )
  );
-- Écriture : aucune policy → refus par défaut sous RLS. Les server actions
-- écrivent via le client service_role (cohérent avec le durcissement RLS 034).

-- 3) Seed des postes AJC (idempotent). Permissions par défaut = uniquement
--    les exemples explicites de Felix ; le reste se règle dans l'UI.
INSERT INTO public.profils_types (nom, slug, permissions, est_defaut, categorie) VALUES
  ('Présidente',                    'presidente',         '{"signer_documents":true,"signer_ba":true,"voir_factures":true}', false, 'bureau'),
  ('Vice-Présidente',               'vice_presidente',    '{}', false, 'bureau'),
  ('Trésorier·ère',                 'tresorier',          '{"signer_documents":true,"voir_factures":true}', false, 'bureau'),
  ('Secrétaire Général',            'secretaire_general', '{}', false, 'bureau'),
  ('Pôle Audit Qualité',            'pole_audit_qualite', '{}', false, 'pole'),
  ('Pôle Développement Commercial', 'pole_dev_co',        '{}', false, 'pole'),
  ('Pôle Ressources Humaines',      'pole_rh',            '{"signer_ba":true,"assigner_intervenants":true}', false, 'pole'),
  ('Pôle Systèmes d''Information',  'pole_si',            '{}', false, 'pole'),
  ('Pôle Marketing',                'pole_marketing',     '{}', false, 'pole')
ON CONFLICT (slug) DO NOTHING;
