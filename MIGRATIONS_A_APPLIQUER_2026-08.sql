-- ════════════════════════════════════════════════════════════════
--  À COLLER DANS LE SQL EDITOR SUPABASE (projet Befast) — une seule fois
--  https://supabase.com/dashboard/project/rslztpjwrrjrvajkwcvo/sql/new
--
--  Vérifié le 24/08/2026 contre la base de production : ces trois migrations
--  sont présentes dans le dépôt mais N'ONT JAMAIS ÉTÉ APPLIQUÉES.
--    022 → colonnes de chiffrement (NSS / IBAN / adresse…)  : absentes
--    036 → table audit_logs                                  : absente
--    051 → personnes.avatar_url + personnes.updated_at       : absentes
--
--  Tout est idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS) :
--  ré-exécuter ce bloc ne casse rien.
-- ════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────
-- 022 — colonnes de chiffrement
-- Sans elles : la carte « Informations sensibles » (NSS / IBAN) du profil
-- échoue (PUT /api/profil → "column personnes.encryption_salt does not exist").
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.personnes ADD COLUMN IF NOT EXISTS nss_iv TEXT;
ALTER TABLE public.personnes ADD COLUMN IF NOT EXISTS nss_auth_tag TEXT;
ALTER TABLE public.personnes ADD COLUMN IF NOT EXISTS iban_iv TEXT;
ALTER TABLE public.personnes ADD COLUMN IF NOT EXISTS iban_auth_tag TEXT;
ALTER TABLE public.personnes ADD COLUMN IF NOT EXISTS adresse_encrypted TEXT;
ALTER TABLE public.personnes ADD COLUMN IF NOT EXISTS adresse_iv TEXT;
ALTER TABLE public.personnes ADD COLUMN IF NOT EXISTS adresse_auth_tag TEXT;
ALTER TABLE public.personnes ADD COLUMN IF NOT EXISTS date_naissance_encrypted TEXT;
ALTER TABLE public.personnes ADD COLUMN IF NOT EXISTS date_naissance_iv TEXT;
ALTER TABLE public.personnes ADD COLUMN IF NOT EXISTS date_naissance_auth_tag TEXT;
ALTER TABLE public.personnes ADD COLUMN IF NOT EXISTS ville_encrypted TEXT;
ALTER TABLE public.personnes ADD COLUMN IF NOT EXISTS ville_iv TEXT;
ALTER TABLE public.personnes ADD COLUMN IF NOT EXISTS ville_auth_tag TEXT;
ALTER TABLE public.personnes ADD COLUMN IF NOT EXISTS code_postal_encrypted TEXT;
ALTER TABLE public.personnes ADD COLUMN IF NOT EXISTS code_postal_iv TEXT;
ALTER TABLE public.personnes ADD COLUMN IF NOT EXISTS code_postal_auth_tag TEXT;
ALTER TABLE public.personnes ADD COLUMN IF NOT EXISTS encryption_salt TEXT;

ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS budget_ht_encrypted TEXT;
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS budget_ht_iv TEXT;
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS budget_ht_auth_tag TEXT;
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS notes_encrypted TEXT;
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS notes_iv TEXT;
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS notes_auth_tag TEXT;
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS encryption_salt TEXT;

ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS notes_encrypted TEXT;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS notes_iv TEXT;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS notes_auth_tag TEXT;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS encryption_salt TEXT;


-- ────────────────────────────────────────────────────────────────
-- 036 — table d'audit
-- Sans elle : logAudit() échoue silencieusement partout (aucune traçabilité
-- des modifications sensibles).
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name  TEXT NOT NULL,
  operation   TEXT NOT NULL,
  record_id   TEXT,
  user_id     UUID REFERENCES public.personnes(id) ON DELETE SET NULL,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user    ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table   ON public.audit_logs (table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs (created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs insert own" ON public.audit_logs;
CREATE POLICY "audit_logs insert own"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "audit_logs read admin" ON public.audit_logs;
CREATE POLICY "audit_logs read admin"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.personnes p
      JOIN public.profils_types pt ON pt.id = p.profil_type_id
      WHERE p.id = auth.uid() AND pt.slug = 'administrateur'
    )
  );


-- ────────────────────────────────────────────────────────────────
-- 051 — avatar_url + updated_at sur personnes
-- Sans elles : POST /api/profil/avatar uploade le fichier puis échoue sur
-- l'UPDATE → la photo de profil n'est jamais conservée.
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.personnes
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS personnes_updated_at ON public.personnes;
CREATE TRIGGER personnes_updated_at
  BEFORE UPDATE ON public.personnes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- PostgREST recharge son cache de schéma (sinon les nouvelles colonnes
-- restent invisibles depuis l'API).
NOTIFY pgrst, 'reload schema';
