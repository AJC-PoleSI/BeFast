-- Migration 004: documents_personnes table, storage buckets, avatar_url column

-- Add avatar_url to personnes
ALTER TABLE public.personnes ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Table des documents personnels
CREATE TABLE public.documents_personnes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personne_id UUID NOT NULL REFERENCES public.personnes(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('carte_identite', 'carte_etudiante', 'carte_vitale', 'preuve_lydia', 'rib')),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(personne_id, type)
);

-- Enable RLS
ALTER TABLE public.documents_personnes ENABLE ROW LEVEL SECURITY;

-- RLS: users can read their own documents
CREATE POLICY "users read own documents"
  ON public.documents_personnes FOR SELECT
  TO authenticated
  USING (auth.uid() = personne_id);

-- RLS: users can insert their own documents
CREATE POLICY "users insert own documents"
  ON public.documents_personnes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = personne_id);

-- RLS: users can delete their own documents
CREATE POLICY "users delete own documents"
  ON public.documents_personnes FOR DELETE
  TO authenticated
  USING (auth.uid() = personne_id);

-- RLS: admins can read all documents
CREATE POLICY "admin read all documents"
  ON public.documents_personnes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.personnes p
      JOIN public.profils_types pt ON pt.id = p.profil_type_id
      WHERE p.id = auth.uid() AND pt.slug = 'administrateur'
    )
  );

-- Trigger updated_at
CREATE TRIGGER documents_personnes_updated_at
  BEFORE UPDATE ON public.documents_personnes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents-personnes', 'documents-personnes', false)
ON CONFLICT DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT DO NOTHING;

-- Storage RLS for documents-personnes bucket
CREATE POLICY "users upload own documents storage"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents-personnes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "users read own documents storage"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents-personnes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "users delete own documents storage"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents-personnes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage RLS for avatars bucket (public read, authenticated upload own)
CREATE POLICY "anyone can read avatars"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

CREATE POLICY "users upload own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "users update own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
