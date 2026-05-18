-- Migration 026 : durcit les RLS factures / facture_lignes
-- Seuls les admins ou les profils avec voir_factures = true peuvent modifier.
-- Lecture : toujours autorisée pour tout authentifié (KPIs trésorerie globaux).

-- Helper : retourne true si user a la permission voir_factures (ou est admin)
CREATE OR REPLACE FUNCTION public.user_can_manage_factures()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.personnes p
    JOIN public.profils_types pt ON pt.id = p.profil_type_id
    WHERE p.id = auth.uid()
      AND (
        pt.slug = 'administrateur'
        OR (pt.permissions ->> 'voir_factures')::boolean = true
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_can_manage_factures() TO authenticated;

-- ============================================================
-- FACTURES : drop + recreate policies avec check permission
-- ============================================================
DROP POLICY IF EXISTS "authenticated read factures" ON public.factures;
DROP POLICY IF EXISTS "authenticated insert factures" ON public.factures;
DROP POLICY IF EXISTS "authenticated update factures" ON public.factures;
DROP POLICY IF EXISTS "authenticated delete factures" ON public.factures;
DROP POLICY IF EXISTS "admin delete factures" ON public.factures;

-- Lecture : tout authentifié (la vue trésorerie a son propre gate côté app)
CREATE POLICY "read factures auth" ON public.factures
  FOR SELECT TO authenticated USING (true);

-- Écriture : nécessite voir_factures ou admin
CREATE POLICY "insert factures perm" ON public.factures
  FOR INSERT TO authenticated
  WITH CHECK (public.user_can_manage_factures());

CREATE POLICY "update factures perm" ON public.factures
  FOR UPDATE TO authenticated
  USING (public.user_can_manage_factures())
  WITH CHECK (public.user_can_manage_factures());

CREATE POLICY "delete factures perm" ON public.factures
  FOR DELETE TO authenticated
  USING (public.user_can_manage_factures());

-- ============================================================
-- FACTURE_LIGNES : même logique
-- ============================================================
DROP POLICY IF EXISTS "authenticated read facture_lignes" ON public.facture_lignes;
DROP POLICY IF EXISTS "authenticated insert facture_lignes" ON public.facture_lignes;
DROP POLICY IF EXISTS "authenticated update facture_lignes" ON public.facture_lignes;
DROP POLICY IF EXISTS "authenticated delete facture_lignes" ON public.facture_lignes;

CREATE POLICY "read facture_lignes auth" ON public.facture_lignes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "insert facture_lignes perm" ON public.facture_lignes
  FOR INSERT TO authenticated
  WITH CHECK (public.user_can_manage_factures());

CREATE POLICY "update facture_lignes perm" ON public.facture_lignes
  FOR UPDATE TO authenticated
  USING (public.user_can_manage_factures())
  WITH CHECK (public.user_can_manage_factures());

CREATE POLICY "delete facture_lignes perm" ON public.facture_lignes
  FOR DELETE TO authenticated
  USING (public.user_can_manage_factures());
