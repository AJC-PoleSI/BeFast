-- 052_permissions_edition_publication_etudes.sql
-- Restreint la modification d'une étude au créateur, au Pôle SI et aux
-- administrateurs (clé `modifier_etudes`), et la publication (passage
-- brouillon → visible) d'une étude/mission au Pôle Marketing, au Pôle SI
-- et aux administrateurs (clés `publier_etudes` / `publier_missions`,
-- déjà présentes dans le type PermissionKey mais jamais assignées).
--
-- L'administrateur passe toujours via hasPermission()/canEditEtude(),
-- inutile de le lister ici. Le créateur d'une étude garde toujours le
-- droit de la modifier (vérifié en code, pas via cette permission).

UPDATE public.profils_types
SET permissions = permissions || '{"modifier_etudes": true, "publier_etudes": true, "publier_missions": true}'::jsonb
WHERE slug = 'pole_si';

UPDATE public.profils_types
SET permissions = permissions || '{"publier_etudes": true, "publier_missions": true}'::jsonb
WHERE slug = 'pole_marketing';
