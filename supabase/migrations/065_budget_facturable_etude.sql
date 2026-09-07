-- Migration 065 : faire descendre le budget de la propale jusqu'à la facture.
--
-- Contexte : `acceptProposal` insérait les blocs d'échéancier avec la seule
-- colonne `jeh`, en laissant `nombre_jeh` à 0 et `prix_jeh` à NULL. Le tableau
-- « Désignation / Nombre de JEH / Montant unitaire / Montant HT » de la facture
-- (buildFactureContext → buildPhasesContext) sortait donc intégralement à 0.
-- Et le suivi de l'étude, qui est une ligne de la facture au même titre que les
-- phases, n'était stocké nulle part côté étude.
--
-- 1. Deux colonnes sur `etudes` pour la ligne « Suivi de l'étude ».
-- 2. Backfill des blocs existants : prix unitaire déduit du budget de l'étude,
--    réparti au prorata des JEH, pour que les études déjà signées produisent
--    une facture cohérente au lieu d'un tableau à zéro.

ALTER TABLE public.etudes
  ADD COLUMN IF NOT EXISTS suivi_jeh      NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS suivi_prix_jeh NUMERIC(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.etudes.suivi_jeh IS
  'Nombre de JEH de suivi de l''étude — ligne « Suivi de l''étude » de la facture.';
COMMENT ON COLUMN public.etudes.suivi_prix_jeh IS
  'Prix unitaire du JEH de suivi, marge de la JE incluse (prix facturé au client).';

-- `nombre_jeh` fait doublon historique avec `jeh` : on aligne les deux pour les
-- blocs où seul `jeh` a été renseigné (toutes les études signées avant 065).
UPDATE public.echeancier_blocs
SET nombre_jeh = jeh
WHERE COALESCE(nombre_jeh, 0) = 0
  AND COALESCE(jeh, 0) > 0;

-- Prix unitaire manquant : on répartit le budget de prestation de l'étude au
-- prorata des JEH de ses blocs, de sorte que Σ (nombre_jeh × prix_jeh) retombe
-- sur `etudes.budget_ht`. Approximation assumée pour l'existant — les études
-- signées après 065 portent le prix réel issu du budget de la propale.
WITH totaux AS (
  SELECT b.etude_id, SUM(COALESCE(b.nombre_jeh, b.jeh, 0)) AS jeh_total
  FROM public.echeancier_blocs b
  GROUP BY b.etude_id
  HAVING SUM(COALESCE(b.nombre_jeh, b.jeh, 0)) > 0
)
UPDATE public.echeancier_blocs b
SET prix_jeh = ROUND(e.budget_ht::numeric / t.jeh_total, 2)
FROM totaux t
JOIN public.etudes e ON e.id = t.etude_id
WHERE b.etude_id = t.etude_id
  AND b.prix_jeh IS NULL
  AND COALESCE(e.budget_ht, 0) > 0;

NOTIFY pgrst, 'reload schema';
