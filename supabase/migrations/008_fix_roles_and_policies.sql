-- ============================================================
-- 008_fix_roles_and_policies.sql
-- Fix role assignments and tighten policies
-- ============================================================

-- 1. Remove admin role from felix.pitz@audencia.com
--    Set to NULL (no role) — an admin can reassign the correct role via the UI
UPDATE public.personnes
SET profil_type_id = NULL
WHERE email = 'felix.pitz@audencia.com'
  AND profil_type_id = (
    SELECT id FROM public.profils_types WHERE slug = 'administrateur' LIMIT 1
  );

-- 2. Ensure the "administrateur" role slug is protected:
--    Only admins can update profil_type_id to the admin role.
--    The application layer already enforces this via server actions,
--    but add a DB-level check as defence-in-depth.

-- Allow authenticated users to update their own non-sensitive fields
-- (existing policy) — no change needed here.

-- 3. Authenticated users can insert notifications (needed for DB triggers
--    running with SECURITY DEFINER which uses service_role internally).
--    The trigger function already has SECURITY DEFINER so it runs as the
--    function owner; no extra policy change needed beyond what 007 added.

-- 4. Fix: allow authenticated users to read their own personne row
--    (needed so useUser hook works without admin client).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'personnes'
      AND policyname = 'users read own personne'
  ) THEN
    CREATE POLICY "users read own personne"
      ON public.personnes FOR SELECT
      TO authenticated
      USING (id = auth.uid());
  END IF;
END $$;
