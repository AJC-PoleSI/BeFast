-- ============================================================
-- 007_document_status_notifications.sql
-- Add document validation status + notifications system
-- ============================================================

-- 1. Add status column to documents_personnes
ALTER TABLE public.documents_personnes
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'approved', 'rejected'));

-- 2. Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type         TEXT NOT NULL,
  title        TEXT NOT NULL,
  message      TEXT,
  data         JSONB,
  read         BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Only admins can read notifications
CREATE POLICY "admin read notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.personnes p
      JOIN public.profils_types pt ON pt.id = p.profil_type_id
      WHERE p.id = auth.uid() AND pt.slug = 'administrateur'
    )
  );

-- Only admins can mark notifications as read (UPDATE)
CREATE POLICY "admin update notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.personnes p
      JOIN public.profils_types pt ON pt.id = p.profil_type_id
      WHERE p.id = auth.uid() AND pt.slug = 'administrateur'
    )
  );

-- Service role can insert (used by triggers and server actions)
CREATE POLICY "service insert notifications"
  ON public.notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 3. Allow admins to update document status
CREATE POLICY "admin update document status"
  ON public.documents_personnes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.personnes p
      JOIN public.profils_types pt ON pt.id = p.profil_type_id
      WHERE p.id = auth.uid() AND pt.slug = 'administrateur'
    )
  )
  WITH CHECK (true);

-- 4. Trigger: notify admin when a new personne row is inserted (= new signup)
CREATE OR REPLACE FUNCTION public.notify_admin_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (type, title, message, data)
  VALUES (
    'new_user',
    'Nouveau membre inscrit',
    'Un nouveau compte a été créé : ' || COALESCE(NEW.email, '(sans email)'),
    jsonb_build_object(
      'user_id', NEW.id,
      'email',   NEW.email,
      'prenom',  NEW.prenom,
      'nom',     NEW.nom
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_new_user ON public.personnes;
CREATE TRIGGER trg_notify_admin_new_user
  AFTER INSERT ON public.personnes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_new_user();

-- 5. Trigger: notify admin when a document is uploaded (status goes to pending)
CREATE OR REPLACE FUNCTION public.notify_admin_document_uploaded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_prenom TEXT;
  v_nom TEXT;
BEGIN
  SELECT email, prenom, nom
  INTO v_email, v_prenom, v_nom
  FROM public.personnes
  WHERE id = NEW.personne_id;

  INSERT INTO public.notifications (type, title, message, data)
  VALUES (
    'document_uploaded',
    'Document en attente de validation',
    COALESCE(v_prenom || ' ' || v_nom, v_email) || ' a uploadé un document (' || NEW.type || ')',
    jsonb_build_object(
      'document_id',  NEW.id,
      'user_id',      NEW.personne_id,
      'email',        v_email,
      'doc_type',     NEW.type,
      'file_name',    NEW.file_name
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_document_uploaded ON public.documents_personnes;
CREATE TRIGGER trg_notify_admin_document_uploaded
  AFTER INSERT ON public.documents_personnes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_document_uploaded();
