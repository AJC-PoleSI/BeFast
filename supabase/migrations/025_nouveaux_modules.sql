-- Migration 025: Nouveaux modules (Support, Notes de frais, Collaboration)

-- ============================================================
-- SUPPORT TICKETS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id UUID REFERENCES public.personnes(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  type_probleme TEXT NOT NULL,
  description TEXT NOT NULL,
  page_url TEXT,
  statut TEXT NOT NULL DEFAULT 'nouveau',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='support_tickets' AND policyname='authenticated insert support_tickets') THEN
    CREATE POLICY "authenticated insert support_tickets" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='support_tickets' AND policyname='user read own support_tickets') THEN
    CREATE POLICY "user read own support_tickets" ON public.support_tickets FOR SELECT TO authenticated USING (utilisateur_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='support_tickets' AND policyname='admin read all support_tickets') THEN
    CREATE POLICY "admin read all support_tickets" ON public.support_tickets FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.personnes p JOIN public.profils_types pt ON pt.id = p.profil_type_id WHERE p.id = auth.uid() AND pt.slug = 'administrateur'));
  END IF;
END $$;

CREATE TRIGGER support_tickets_updated_at BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- NOTES DE FRAIS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notes_de_frais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intervenant_id UUID NOT NULL REFERENCES public.personnes(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  numero_note_de_frais TEXT UNIQUE,
  montant_total NUMERIC(10,2),
  fichiers_justificatifs JSONB DEFAULT '[]'::jsonb,
  description TEXT,
  statut TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon','soumis','valide','paye')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  validated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS note_frais_seq START 1;

CREATE OR REPLACE FUNCTION set_numero_note_de_frais()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_note_de_frais IS NULL THEN
    NEW.numero_note_de_frais := 'NF-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('note_frais_seq')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER note_frais_numero_trigger
  BEFORE INSERT ON public.notes_de_frais
  FOR EACH ROW EXECUTE FUNCTION set_numero_note_de_frais();

ALTER TABLE public.notes_de_frais ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notes_de_frais' AND policyname='user read own notes_de_frais') THEN
    CREATE POLICY "user read own notes_de_frais" ON public.notes_de_frais FOR SELECT TO authenticated
      USING (intervenant_id = auth.uid() OR EXISTS (SELECT 1 FROM public.personnes p JOIN public.profils_types pt ON pt.id = p.profil_type_id WHERE p.id = auth.uid() AND pt.slug IN ('administrateur', 'tresorerie')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notes_de_frais' AND policyname='user manage own notes_de_frais') THEN
    CREATE POLICY "user manage own notes_de_frais" ON public.notes_de_frais FOR ALL TO authenticated
      USING (intervenant_id = auth.uid()) WITH CHECK (intervenant_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notes_de_frais' AND policyname='admin manage notes_de_frais') THEN
    CREATE POLICY "admin manage notes_de_frais" ON public.notes_de_frais FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.personnes p JOIN public.profils_types pt ON pt.id = p.profil_type_id WHERE p.id = auth.uid() AND pt.slug IN ('administrateur', 'tresorerie')))
      WITH CHECK (EXISTS (SELECT 1 FROM public.personnes p JOIN public.profils_types pt ON pt.id = p.profil_type_id WHERE p.id = auth.uid() AND pt.slug IN ('administrateur', 'tresorerie')));
  END IF;
END $$;

CREATE TRIGGER notes_de_frais_updated_at BEFORE UPDATE ON public.notes_de_frais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- MISSION COLLABORATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mission_collaborations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL UNIQUE REFERENCES public.missions(id) ON DELETE CASCADE,
  intervenant_id UUID NOT NULL REFERENCES public.personnes(id) ON DELETE CASCADE,
  chef_projet_id UUID REFERENCES public.personnes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mission_collaborations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mission_collaborations' AND policyname='collaborators read mission_collaborations') THEN
    CREATE POLICY "collaborators read mission_collaborations" ON public.mission_collaborations FOR SELECT TO authenticated
      USING (intervenant_id = auth.uid() OR chef_projet_id = auth.uid() OR EXISTS (SELECT 1 FROM public.personnes p JOIN public.profils_types pt ON pt.id = p.profil_type_id WHERE p.id = auth.uid() AND pt.slug = 'administrateur'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mission_collaborations' AND policyname='chef_projet manage mission_collaborations') THEN
    CREATE POLICY "chef_projet manage mission_collaborations" ON public.mission_collaborations FOR ALL TO authenticated
      USING (chef_projet_id = auth.uid() OR EXISTS (SELECT 1 FROM public.personnes p JOIN public.profils_types pt ON pt.id = p.profil_type_id WHERE p.id = auth.uid() AND pt.slug = 'administrateur'))
      WITH CHECK (chef_projet_id = auth.uid() OR EXISTS (SELECT 1 FROM public.personnes p JOIN public.profils_types pt ON pt.id = p.profil_type_id WHERE p.id = auth.uid() AND pt.slug = 'administrateur'));
  END IF;
END $$;

CREATE TRIGGER mission_collaborations_updated_at BEFORE UPDATE ON public.mission_collaborations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- MISSION DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mission_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_collaboration_id UUID NOT NULL REFERENCES public.mission_collaborations(id) ON DELETE CASCADE,
  nom_fichier TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES public.personnes(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mission_documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mission_documents' AND policyname='collaborators read mission_documents') THEN
    CREATE POLICY "collaborators read mission_documents" ON public.mission_documents FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.mission_collaborations mc WHERE mc.id = mission_documents.mission_collaboration_id AND (mc.intervenant_id = auth.uid() OR mc.chef_projet_id = auth.uid() OR EXISTS (SELECT 1 FROM public.personnes p JOIN public.profils_types pt ON pt.id = p.profil_type_id WHERE p.id = auth.uid() AND pt.slug = 'administrateur'))));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mission_documents' AND policyname='collaborators insert mission_documents') THEN
    CREATE POLICY "collaborators insert mission_documents" ON public.mission_documents FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM public.mission_collaborations mc WHERE mc.id = mission_collaboration_id AND (mc.intervenant_id = auth.uid() OR mc.chef_projet_id = auth.uid() OR EXISTS (SELECT 1 FROM public.personnes p JOIN public.profils_types pt ON pt.id = p.profil_type_id WHERE p.id = auth.uid() AND pt.slug = 'administrateur'))));
  END IF;
END $$;

-- ============================================================
-- MISSION CHECKLIST
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mission_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_collaboration_id UUID NOT NULL REFERENCES public.mission_collaborations(id) ON DELETE CASCADE,
  description_tache TEXT NOT NULL,
  date_echeance DATE,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_by UUID REFERENCES public.personnes(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mission_checklist ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mission_checklist' AND policyname='collaborators read mission_checklist') THEN
    CREATE POLICY "collaborators read mission_checklist" ON public.mission_checklist FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.mission_collaborations mc WHERE mc.id = mission_checklist.mission_collaboration_id AND (mc.intervenant_id = auth.uid() OR mc.chef_projet_id = auth.uid() OR EXISTS (SELECT 1 FROM public.personnes p JOIN public.profils_types pt ON pt.id = p.profil_type_id WHERE p.id = auth.uid() AND pt.slug = 'administrateur'))));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mission_checklist' AND policyname='collaborators manage mission_checklist') THEN
    CREATE POLICY "collaborators manage mission_checklist" ON public.mission_checklist FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.mission_collaborations mc WHERE mc.id = mission_collaboration_id AND (mc.intervenant_id = auth.uid() OR mc.chef_projet_id = auth.uid() OR EXISTS (SELECT 1 FROM public.personnes p JOIN public.profils_types pt ON pt.id = p.profil_type_id WHERE p.id = auth.uid() AND pt.slug = 'administrateur'))))
      WITH CHECK (EXISTS (SELECT 1 FROM public.mission_collaborations mc WHERE mc.id = mission_collaboration_id AND (mc.intervenant_id = auth.uid() OR mc.chef_projet_id = auth.uid() OR EXISTS (SELECT 1 FROM public.personnes p JOIN public.profils_types pt ON pt.id = p.profil_type_id WHERE p.id = auth.uid() AND pt.slug = 'administrateur'))));
  END IF;
END $$;

CREATE TRIGGER mission_checklist_updated_at BEFORE UPDATE ON public.mission_checklist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- STORAGE BUCKETS (If not exist)
-- ============================================================
-- Note: Supabase storage buckets and policies are typically handled via the UI or seed data.
-- But we ensure we have the structure needed.
