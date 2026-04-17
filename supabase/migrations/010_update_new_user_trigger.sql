-- Migration 010: Update handle_new_user trigger

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  default_role_id UUID;
BEGIN
  -- Get the 'membre_en_attente' role ID
  SELECT id INTO default_role_id FROM public.profils_types WHERE slug = 'membre_en_attente';
  
  -- Fallback to default role if not found
  IF default_role_id IS NULL THEN
    SELECT id INTO default_role_id FROM public.profils_types WHERE est_defaut = true LIMIT 1;
  END IF;

  INSERT INTO public.personnes (id, email, prenom, nom, profil_type_id, account_status)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'prenom',
    NEW.raw_user_meta_data->>'nom',
    default_role_id,
    'pending_validation'
  );
  RETURN NEW;
END;
$$;
