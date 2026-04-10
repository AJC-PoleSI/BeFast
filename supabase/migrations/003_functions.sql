-- Custom access token hook: embed role slug in JWT claims
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  claims jsonb;
  user_role_slug text;
BEGIN
  SELECT pt.slug INTO user_role_slug
    FROM public.personnes p
    JOIN public.profils_types pt ON pt.id = p.profil_type_id
    WHERE p.id = (event->>'user_id')::uuid;

  claims := event->'claims';

  IF user_role_slug IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_role}', to_jsonb(user_role_slug));
  ELSE
    claims := jsonb_set(claims, '{app_role}', 'null'::jsonb);
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant to supabase_auth_admin (required for auth hooks)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- Grant usage on tables needed by the hook
GRANT SELECT ON public.personnes TO supabase_auth_admin;
GRANT SELECT ON public.profils_types TO supabase_auth_admin;
