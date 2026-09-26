-- ============================================================
-- Migration 076 : correctifs Security Advisor sur les fonctions (26/09/2026)
--
-- 1. Fonctions SECURITY DEFINER appelables sans être connecté via
--    /rest/v1/rpc/<nom> : Postgres donne EXECUTE à PUBLIC par défaut.
--    a) Fonctions de trigger : personne n'a à les appeler directement.
--       Le déclenchement d'un trigger ne vérifie pas EXECUTE (testé en
--       prod avant application) → on retire le droit à tous les rôles API.
--    b) Helpers RLS : les 45 policies qui les appellent sont toutes
--       TO authenticated, aucune n'est évaluée pour anon, et l'appli ne
--       les appelle jamais en .rpc() → retrait pour PUBLIC/anon uniquement.
--       authenticated DOIT garder EXECUTE, sinon la RLS lève
--       « permission denied for function » : l'avertissement Advisor
--       « Signed-In Users Can Execute SECURITY DEFINER Function » reste
--       donc volontairement ouvert pour ces 8 helpers.
--
-- 2. search_path figé à public sur les 10 fonctions qui n'en avaient pas
--    (même convention que les helpers existants). Les corps n'utilisent
--    que des objets de public (ou qualifiés auth.uid()) : aucun changement
--    de comportement.
--    ⚠️ Un futur CREATE OR REPLACE de ces fonctions doit reprendre
--    « SET search_path = public », sinon le réglage est perdu.
-- ============================================================

-- 1a. Fonctions de trigger SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_personnes_colonnes_sensibles() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admin_new_user()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admin_document_uploaded()     FROM PUBLIC, anon, authenticated;

-- 1b. Helpers RLS SECURITY DEFINER : réservés aux utilisateurs connectés
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid)                     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text)         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_compte_actif(uuid)              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_membre_interne(uuid)            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.est_suiveur_etude(uuid, uuid)      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.intervient_sur_etude(uuid, uuid)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_mission_intervenant(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_mission_publiee(uuid)           FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.is_admin(uuid),
  public.has_permission(uuid, text),
  public.is_compte_actif(uuid),
  public.is_membre_interne(uuid),
  public.est_suiveur_etude(uuid, uuid),
  public.intervient_sur_etude(uuid, uuid),
  public.is_mission_intervenant(uuid, uuid),
  public.is_mission_publiee(uuid)
TO authenticated, service_role;

-- 2. search_path figé
ALTER FUNCTION public.handle_new_user()                SET search_path = public;
ALTER FUNCTION public.custom_access_token_hook(jsonb)  SET search_path = public;
ALTER FUNCTION public.get_my_role()                    SET search_path = public;
ALTER FUNCTION public.has_permission(text)             SET search_path = public;
ALTER FUNCTION public.update_updated_at()              SET search_path = public;
ALTER FUNCTION public.set_factures_updated_at()        SET search_path = public;
ALTER FUNCTION public.recalc_facture_montant()         SET search_path = public;
ALTER FUNCTION public.set_numero_note_de_frais()       SET search_path = public;
ALTER FUNCTION public.touch_account_links_updated_at() SET search_path = public;
ALTER FUNCTION public.set_retributions_updated_at()    SET search_path = public;
