-- Enable RLS
ALTER TABLE public.personnes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profils_types ENABLE ROW LEVEL SECURITY;

-- Helper: get user role slug from JWT claims
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    current_setting('request.jwt.claims', true)::jsonb->>'app_role',
    null
  )
$$;

-- Helper: check permission for a page
CREATE OR REPLACE FUNCTION public.has_permission(page_name text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    (SELECT (pt.permissions->>page_name)::boolean
     FROM public.personnes p
     JOIN public.profils_types pt ON pt.id = p.profil_type_id
     WHERE p.id = auth.uid()),
    false
  )
$$;

-- profils_types: tous les authentifies peuvent lire
CREATE POLICY "authenticated read profils_types"
  ON public.profils_types FOR SELECT
  TO authenticated
  USING (true);

-- profils_types: seuls les admins modifient
CREATE POLICY "admin manage profils_types"
  ON public.profils_types FOR ALL
  TO authenticated
  USING (public.get_my_role() = 'administrateur');

-- personnes: lire son propre profil
CREATE POLICY "users read own profile"
  ON public.personnes FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- personnes: admins lisent tous les profils
CREATE POLICY "admin read all profiles"
  ON public.personnes FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'administrateur');

-- personnes: modifier son propre profil
CREATE POLICY "users update own profile"
  ON public.personnes FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- personnes: admins modifient tous les profils
CREATE POLICY "admin update all profiles"
  ON public.personnes FOR UPDATE
  TO authenticated
  USING (public.get_my_role() = 'administrateur');
