-- ============================================================
-- Migration 075 : correctifs Security Advisor (26/09/2026)
--
-- 1. public.rejets_balayage_2026_09 — sauvegarde du balayage des rejets
--    (160 lignes : email, statut, motif). RLS désactivée et droits complets
--    pour anon/authenticated : lisible ET effaçable avec la clé publique.
--    Aucun code de l'appli ne la lit → RLS sans policy + retrait des droits.
--    Seul le service_role (dashboard / MCP) y accède encore.
--
-- 2. public.v_budget_unifie (migration 031) — vue SECURITY DEFINER par défaut :
--    elle s'exécutait avec les droits de postgres et contournait la RLS de
--    proposal_phases, budget_etude et missions (prix JEH, montants) pour anon.
--    Passage en security_invoker : la RLS des tables sources s'applique.
--    Non utilisée par l'appli ; anon n'a plus aucun droit dessus.
-- ============================================================

-- 1. Table de sauvegarde du balayage
ALTER TABLE public.rejets_balayage_2026_09 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rejets_balayage_2026_09 FROM anon, authenticated;

-- 2. Vue budget unifiée
ALTER VIEW public.v_budget_unifie SET (security_invoker = true);
REVOKE ALL ON public.v_budget_unifie FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.v_budget_unifie FROM authenticated;
