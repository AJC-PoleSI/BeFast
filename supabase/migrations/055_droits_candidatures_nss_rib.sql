-- 055_droits_candidatures_nss_rib.sql
--
-- 1. Helper SQL `has_permission` : équivalent Postgres de hasPermission()
--    côté TypeScript (rôle de base ∪ postes, l'administrateur passe toujours).
-- 2. Accepter / refuser une candidature devient réservé au pôle RH et aux
--    administrateurs (permission `selectionner_candidats`), en RLS et plus
--    seulement dans l'UI.
-- 3. Attribution des droits PII : NSS + justificatifs au pôle RH, RIB à la
--    trésorerie (nouvelles clés `voir_nss` / `voir_rib`).

-- ============================================================
-- 1. HELPER
-- ============================================================
-- SECURITY DEFINER : lit personnes/profils_types/personne_postes hors RLS,
-- sinon récursion dans les policies (même principe que is_membre_interne).
CREATE OR REPLACE FUNCTION public.has_permission(p_user_id uuid, p_key text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT
    public.is_admin(p_user_id)
    OR EXISTS (
      SELECT 1 FROM public.personnes p
      JOIN public.profils_types pt ON pt.id = p.profil_type_id
      WHERE p.id = p_user_id AND (pt.permissions -> p_key) = 'true'::jsonb
    )
    OR EXISTS (
      SELECT 1 FROM public.personne_postes pp
      JOIN public.profils_types pt ON pt.id = pp.poste_id
      WHERE pp.personne_id = p_user_id AND (pt.permissions -> p_key) = 'true'::jsonb
    );
$$;

-- ============================================================
-- 2. CANDIDATURES : seuls RH + admins décident
-- ============================================================
-- Avant : `personne_id = auth.uid() OR is_membre_interne(...)`, ce qui laissait
-- (a) n'importe quel membre interne accepter/refuser, (b) un candidat modifier
-- sa propre ligne — donc passer son statut à 'acceptee' lui-même.
-- L'application ne met jamais à jour une candidature côté candidat (elle ne
-- fait qu'un INSERT), la restriction ne casse donc aucun parcours existant.
DROP POLICY IF EXISTS "candidatures update" ON public.candidatures;

CREATE POLICY "candidatures update" ON public.candidatures FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'selectionner_candidats'))
  WITH CHECK (public.has_permission(auth.uid(), 'selectionner_candidats'));

-- ============================================================
-- 3. DROITS PAR POSTE
-- ============================================================
-- Pôle RH (6 personnes) et Responsable RH (1) : décident des candidatures,
-- consultent les justificatifs et le NSS.
UPDATE public.profils_types
SET permissions = permissions || '{"selectionner_candidats": true, "voir_documents_membres": true, "voir_nss": true}'::jsonb
WHERE slug IN ('pole_rh', 'responsable_rh');

-- Trésorerie : seule (avec les admins) à voir les coordonnées bancaires.
UPDATE public.profils_types
SET permissions = permissions || '{"voir_rib": true}'::jsonb
WHERE slug = 'tresorier';

NOTIFY pgrst, 'reload schema';
