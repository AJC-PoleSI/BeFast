-- Table des types de profils (roles) avec permissions JSONB
CREATE TABLE public.profils_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  est_defaut BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table des personnes (profils utilisateurs)
CREATE TABLE public.personnes (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  prenom TEXT,
  nom TEXT,
  portable TEXT,
  promo TEXT,
  adresse TEXT,
  ville TEXT,
  code_postal TEXT,
  pole TEXT,
  nss_encrypted TEXT,
  iban_encrypted TEXT,
  encryption_key_version INTEGER DEFAULT 1,
  profil_type_id UUID REFERENCES public.profils_types(id),
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed les 4 roles par defaut
INSERT INTO public.profils_types (nom, slug, permissions, est_defaut) VALUES
  ('Membre AGC', 'membre_agc', '{"dashboard":true,"profil":true,"missions":true,"etudes":true,"documents":true}', true),
  ('Ancien Membre AGC', 'ancien_membre_agc', '{"dashboard":true,"profil":true,"documents":true}', true),
  ('Intervenant', 'intervenant', '{"dashboard":true,"profil":true,"missions":true,"documents":true}', true),
  ('Administrateur', 'administrateur', '{"dashboard":true,"profil":true,"missions":true,"etudes":true,"prospection":true,"statistiques":true,"administration":true,"documents":true}', true);

-- Trigger pour creer un profil personne quand un user s'inscrit
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.personnes (id, email, prenom, nom)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'prenom',
    NEW.raw_user_meta_data->>'nom'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER personnes_updated_at BEFORE UPDATE ON public.personnes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER profils_types_updated_at BEFORE UPDATE ON public.profils_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
