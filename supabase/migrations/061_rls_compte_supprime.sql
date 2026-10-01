-- Migration 061 : un compte `account_status = 'deleted'` n'était bloqué que
-- côté application (redirect() dans app/(dashboard)/layout.tsx). La fenêtre
-- entre la suppression et l'expiration du token de session Supabase restait
-- ouverte côté RLS (audit sécurité du 2026-09-07) : les policies
-- "candidatures insert own" et "notes_de_frais insert own" (migration 050)
-- ne vérifiaient jamais `account_status`.
--
-- On ajoute le contrôle directement dans les policies concernées plutôt que
-- de dupliquer is_membre_interne/intervient_sur_etude : un compte supprimé
-- doit être bloqué en écriture partout, y compris si un jeton de session
-- encore valide subsiste.

CREATE OR REPLACE FUNCTION public.is_compte_actif(p_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.personnes p
    WHERE p.id = p_user_id AND p.account_status IS DISTINCT FROM 'deleted'
  );
$$;

DROP POLICY IF EXISTS "candidatures insert own" ON public.candidatures;
CREATE POLICY "candidatures insert own" ON public.candidatures FOR INSERT TO authenticated
  WITH CHECK (personne_id = auth.uid() AND public.is_compte_actif(auth.uid()));

DROP POLICY IF EXISTS "notes_de_frais insert own" ON public.notes_de_frais;
CREATE POLICY "notes_de_frais insert own" ON public.notes_de_frais FOR INSERT TO authenticated
  WITH CHECK (intervenant_id = auth.uid() AND public.is_compte_actif(auth.uid()));

NOTIFY pgrst, 'reload schema';
