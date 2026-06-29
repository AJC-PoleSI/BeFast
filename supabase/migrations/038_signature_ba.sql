-- 038 — Bulletins d'adhésion & file de signature du bureau (LiveConsent)
-- Idempotent : ré-exécutable sans risque.
--
-- Étend signature_requests pour : catégorie (libre|ba), membre concerné,
-- signataires ordonnés, expiration + relances, archivage. Ajoute le toggle
-- d'envoi automatique du BA sur personnes, et la colonne destinataire sur
-- notifications (pour les notifications membre in-app).

-- ── signature_requests : colonnes BA / multi-signataires / relances ──────────
ALTER TABLE public.signature_requests
  ADD COLUMN IF NOT EXISTS category         TEXT NOT NULL DEFAULT 'libre',
  ADD COLUMN IF NOT EXISTS personne_id      UUID REFERENCES public.personnes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signers          JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS validity_days    INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS expires_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_count   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived         BOOLEAN NOT NULL DEFAULT false;

-- Contrainte de catégorie (drop+create pour rester idempotent et tolérer un
-- ancien CHECK absent).
ALTER TABLE public.signature_requests
  DROP CONSTRAINT IF EXISTS signature_requests_category_check;
ALTER TABLE public.signature_requests
  ADD CONSTRAINT signature_requests_category_check
  CHECK (category IN ('libre','ba'));

CREATE INDEX IF NOT EXISTS idx_signature_requests_category
  ON public.signature_requests (category);
CREATE INDEX IF NOT EXISTS idx_signature_requests_personne
  ON public.signature_requests (personne_id);
CREATE INDEX IF NOT EXISTS idx_signature_requests_expires_at
  ON public.signature_requests (expires_at)
  WHERE archived = false;

-- ── personnes : envoi automatique du BA (toggle par membre) ──────────────────
ALTER TABLE public.personnes
  ADD COLUMN IF NOT EXISTS ba_auto BOOLEAN NOT NULL DEFAULT true;

-- ── notifications : destinataire (notifications membre in-app) ───────────────
-- La table existait en admin-only/global (007). On ajoute un destinataire et on
-- ouvre la lecture/maj de SES propres notifications à chaque utilisateur.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES public.personnes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON public.notifications (recipient_id, read);

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid());

-- Réglages bureau / BA stockés dans parametres (key→value) — pas de table
-- dédiée nécessaire. Clés utilisées par l'app (créées à la première écriture) :
--   president_user_id, tresorier_user_id  — utilisateurs signataires du bureau
--   ba_template_path                       — chemin Scaleway du template PDF du BA
--   ba_reminder_days                       — "7,2" (jours avant expiration)
