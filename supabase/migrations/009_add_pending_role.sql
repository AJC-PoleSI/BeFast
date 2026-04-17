-- Migration 009: Add pending member role

INSERT INTO public.profils_types (nom, slug, permissions, est_defaut)
VALUES (
  'Membre en attente',
  'membre_en_attente',
  '{"dashboard":true,"profil":true}',
  false
);
