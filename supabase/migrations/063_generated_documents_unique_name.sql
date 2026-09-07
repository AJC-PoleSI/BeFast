-- Migration 063 : empêche au niveau base la condition de course confirmée
-- par l'audit du 2026-09-07 sur /api/documents/generate — deux générations
-- concurrentes pour la même étude/mission pouvaient produire deux documents
-- portant exactement la même référence imprimée (ex. "26 RDM01 18"), le
-- compteur étant lu puis écrit sans verrou. Le code applicatif (route
-- generate) retente désormais avec un nouveau compteur si cette contrainte
-- rejette l'insertion.
--
-- Au moins un doublon existant en prod bloquait la création de la contrainte
-- (ex. "26 F02 01.docx" généré deux fois à 6h d'écart pour la même facture,
-- ERROR 23505 sur ADD CONSTRAINT). On désambiguïse d'abord les doublons —
-- en renommant, jamais en supprimant : chaque ligne référence un fichier
-- réellement stocké (`file_path` distinct), les deux restent téléchargeables
-- et l'historique de génération n'est pas amputé. Seule la ligne la plus
-- ancienne de chaque groupe en doublon est renommée (elle a été supplantée
-- par une régénération) ; générique, donc protège aussi les doublons
-- éventuels sur d'autres environnements.
WITH doublons AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY scope, entity_id, file_name ORDER BY created_at DESC, id DESC
    ) AS rang
  FROM public.generated_documents
)
UPDATE public.generated_documents gd
SET file_name = regexp_replace(gd.file_name, '(\.[^.]+)?$', ' (remplacé ' || to_char(gd.created_at, 'YYYY-MM-DD HH24:MI') || ')\1')
FROM doublons d
WHERE d.id = gd.id
  AND d.rang > 1;

-- Rejouable : sans ce DROP, un second passage échoue en 42710
-- (constraint already exists).
ALTER TABLE public.generated_documents
  DROP CONSTRAINT IF EXISTS generated_documents_scope_entity_filename_key;

ALTER TABLE public.generated_documents
  ADD CONSTRAINT generated_documents_scope_entity_filename_key
  UNIQUE (scope, entity_id, file_name);
