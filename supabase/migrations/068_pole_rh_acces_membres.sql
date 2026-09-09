-- 068_pole_rh_acces_membres.sql
-- Donne au Pôle RH la permission "membres" pour qu'il puisse accéder à
-- l'onglet Membres de l'espace administration (liste + fiches), au même
-- titre que le Pôle Trésorerie (cf. migration 064).

UPDATE public.profils_types
SET permissions = permissions || '{"membres": true}'::jsonb
WHERE slug = 'pole_rh';
