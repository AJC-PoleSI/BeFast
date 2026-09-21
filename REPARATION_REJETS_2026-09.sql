-- ════════════════════════════════════════════════════════════════
--  À COLLER DANS LE SQL EDITOR SUPABASE (projet Befast) — une seule fois
--  https://supabase.com/dashboard/project/rslztpjwrrjrvajkwcvo/sql/new
--
--  RÉPARATION — balayage de la file de validation des 17-18/09/2026
--
--  160 comptes ont été passés en `rejected` à la main depuis l'écran
--  Administration → Membres, un par un (3 à 4 s d'intervalle), en descendant
--  la liste triée par created_at DESC : 137 candidats du recrutement et
--  23 autres comptes (surtout des intervenants, dont 13 de l'import du 02/07).
--  Aucun motif n'a été saisi, aucun e-mail n'est parti.
--
--  Ce script les remet en `pending_validation` — leur état d'avant le
--  balayage — et efface les traces de rejet. Les 3 rejets antérieurs au
--  17/09 sont de vrais rejets : la fenêtre temporelle les exclut.
--
--  Idempotent : ré-exécuter ne touche plus rien (le WHERE ne matche
--  que `account_status = 'rejected'`).
-- ════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Photo de l'état actuel avant de le défaire. Table de secours : si une
--    partie du balayage était en fait légitime, elle dit exactement qui
--    remettre en `rejected` et quand il l'avait été.
CREATE TABLE IF NOT EXISTS public.rejets_balayage_2026_09 AS
SELECT id, email, account_status, is_candidate,
       rejection_reason, rejected_at, rejected_by,
       now() AS sauvegarde_le
FROM public.personnes
WHERE account_status = 'rejected'
  AND rejected_at BETWEEN '2026-09-17 07:59:00+00' AND '2026-09-18 16:30:00+00';

-- 2. Restauration.
UPDATE public.personnes
SET account_status   = 'pending_validation',
    rejection_reason = NULL,
    rejected_at      = NULL,
    rejected_by      = NULL
WHERE account_status = 'rejected'
  AND rejected_at BETWEEN '2026-09-17 07:59:00+00' AND '2026-09-18 16:30:00+00';

-- 3. Contrôle — attendu : 160 lignes sauvegardées, 0 rejet restant dans la
--    fenêtre, et les 3 rejets légitimes hors fenêtre toujours en place.
SELECT
  (SELECT count(*) FROM public.rejets_balayage_2026_09)                  AS sauvegardes,
  (SELECT count(*) FROM public.personnes
    WHERE account_status = 'rejected'
      AND rejected_at BETWEEN '2026-09-17 07:59:00+00'
                          AND '2026-09-18 16:30:00+00')                  AS rejets_restants_dans_la_fenetre,
  (SELECT count(*) FROM public.personnes WHERE account_status = 'rejected') AS rejets_legitimes_conserves,
  (SELECT count(*) FROM public.personnes
    WHERE account_status = 'pending_validation' AND is_candidate)        AS candidats_en_attente,
  (SELECT count(*) FROM public.personnes
    WHERE account_status = 'pending_validation' AND NOT is_candidate)    AS membres_en_attente;

COMMIT;

-- ────────────────────────────────────────────────────────────────
-- ANNULATION (si besoin de revenir en arrière) :
--
-- UPDATE public.personnes p
-- SET account_status   = s.account_status,
--     rejection_reason = s.rejection_reason,
--     rejected_at      = s.rejected_at,
--     rejected_by      = s.rejected_by
-- FROM public.rejets_balayage_2026_09 s
-- WHERE p.id = s.id;
-- ────────────────────────────────────────────────────────────────
