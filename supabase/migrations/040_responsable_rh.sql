-- 040_responsable_rh.sql
-- Poste « Responsable RH » (plus de droits que le pôle RH), ajustements signer_ba.

-- 1) Responsable RH : signe les BA + assigne les intervenants (plus de droits que l'équipe RH).
INSERT INTO public.profils_types (nom, slug, permissions, est_defaut, categorie) VALUES
  ('Responsable RH', 'responsable_rh', '{"signer_ba":true,"assigner_intervenants":true}', false, 'pole')
ON CONFLICT (slug) DO NOTHING;

-- 2) Le pôle RH (l'équipe) garde assigner_intervenants mais ne signe PLUS les BA
--    (signer un BA = privilège du responsable).
UPDATE public.profils_types
  SET permissions = permissions - 'signer_ba'
  WHERE slug = 'pole_rh';

-- 3) Le trésorier peut aussi signer les BA (règle : signataires BA = présidente / trésorier / RH).
UPDATE public.profils_types
  SET permissions = permissions || '{"signer_ba":true}'::jsonb
  WHERE slug = 'tresorier';
