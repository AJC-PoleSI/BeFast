-- 037 — Suivi des demandes de signature électronique LiveConsent
-- Idempotent : ré-exécutable sans risque.

CREATE TABLE IF NOT EXISTS public.signature_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lc_request_id       TEXT UNIQUE NOT NULL,          -- request_id retourné par LiveConsent
  request_name        TEXT NOT NULL,
  document_filename   TEXT NOT NULL,
  recipient_firstname TEXT,
  recipient_lastname  TEXT,
  recipient_email     TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'envoyee',
  last_event_code     INTEGER,
  last_event_at       TIMESTAMPTZ,
  events              JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by          UUID REFERENCES public.personnes(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signature_requests_created_at
  ON public.signature_requests (created_at DESC);

ALTER TABLE public.signature_requests ENABLE ROW LEVEL SECURITY;

-- Lecture pour tout utilisateur connecté ; écritures uniquement via le
-- service role (action serveur d'envoi + webhook de statut).
DROP POLICY IF EXISTS "signature_requests_select_authenticated" ON public.signature_requests;
CREATE POLICY "signature_requests_select_authenticated"
  ON public.signature_requests FOR SELECT TO authenticated USING (true);
