-- Migration 020: Fix account status default and handle_new_user trigger
-- Ensure the column default is correct
ALTER TABLE public.personnes 
  ALTER COLUMN account_status SET DEFAULT 'pending_validation';

-- Update the handle_new_user function to be more robust
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  default_role_id UUID;
BEGIN
  -- We want the 'intervenant' role as the default for new registrations
  -- if 'membre_en_attente' doesn't exist anymore.
  SELECT id INTO default_role_id FROM public.profils_types WHERE slug = 'intervenant';
  
  -- Fallback to any default role if 'intervenant' not found
  IF default_role_id IS NULL THEN
    SELECT id INTO default_role_id FROM public.profils_types WHERE est_defaut = true LIMIT 1;
  END IF;

  INSERT INTO public.personnes (id, email, prenom, nom, profil_type_id, account_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'prenom', ''),
    COALESCE(NEW.raw_user_meta_data->>'nom', ''),
    default_role_id,
    'pending_validation' -- Explicitly set to pending
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
