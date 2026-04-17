-- Add new columns to personnes table for extended profile
ALTER TABLE public.personnes
ADD COLUMN IF NOT EXISTS etablissement TEXT CHECK (etablissement IN ('Audencia Nantes', 'Audencia Bachelor', 'Audencia Paris', null)),
ADD COLUMN IF NOT EXISTS scolarite TEXT CHECK (scolarite IN ('Pré-Master', 'Master 1', 'Master 2', null)),
ADD COLUMN IF NOT EXISTS date_naissance DATE;

-- Create table for custom field definitions
CREATE TABLE IF NOT EXISTS public.custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('text', 'select', 'date', 'number')),
  required BOOLEAN NOT NULL DEFAULT false,
  options JSONB, -- For type='select': {"values": ["option1", "option2"]}
  description TEXT,
  ordre INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create table for custom field values per user
CREATE TABLE IF NOT EXISTS public.custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.personnes(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES public.custom_fields(id) ON DELETE CASCADE,
  value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, field_id)
);

-- Create updated_at triggers for new tables
CREATE TRIGGER custom_fields_updated_at BEFORE UPDATE ON public.custom_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER custom_field_values_updated_at BEFORE UPDATE ON public.custom_field_values
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS custom_field_values_user_id_idx ON public.custom_field_values(user_id);
CREATE INDEX IF NOT EXISTS custom_field_values_field_id_idx ON public.custom_field_values(field_id);
CREATE INDEX IF NOT EXISTS custom_fields_slug_idx ON public.custom_fields(slug);

-- RLS Policies
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;

-- Anyone can read custom field definitions
CREATE POLICY "custom_fields_read" ON public.custom_fields
  FOR SELECT USING (true);

-- Users can only read/update their own custom field values
CREATE POLICY "custom_field_values_read_own" ON public.custom_field_values
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "custom_field_values_update_own" ON public.custom_field_values
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "custom_field_values_insert_own" ON public.custom_field_values
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "custom_field_values_delete_own" ON public.custom_field_values
  FOR DELETE USING (user_id = auth.uid());

-- Admins can do everything with custom fields (requires admin check in app layer)
-- This is handled via admin API routes, not via RLS
