-- 064_pole_tresorerie.sql
-- Ajoute un poste "Pôle Trésorerie" cumulable (comme Pôle SI, Pôle RH…) afin
-- que plusieurs membres — pas seulement le·la Trésorier·ère du bureau —
-- puissent avoir accès à l'onglet Trésorerie (voir_factures), notamment pour
-- y créer des factures à partir des études.
--
-- Assignation ensuite via l'admin Membres (postes cumulés, personne_postes) —
-- aucune migration supplémentaire nécessaire pour attribuer le poste.

INSERT INTO public.profils_types (nom, slug, permissions, est_defaut, categorie)
VALUES ('Pôle Trésorerie', 'pole_tresorerie', '{"voir_factures": true, "membres": true}', false, 'pole')
ON CONFLICT (slug) DO NOTHING;
