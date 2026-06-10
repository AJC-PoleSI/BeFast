-- Migration 036: Table d'audit pour les opérations sensibles
--
-- Contexte : les routes API (profil, trésorerie, upload de frais) appellent
-- logAudit() pour tracer les modifications sensibles. La table cible n'existait
-- pas — les appels échouaient silencieusement. On la crée ici avec une RLS
-- stricte : chacun n'insère que ses propres lignes, seuls les admins lisent.

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name  TEXT NOT NULL,
  operation   TEXT NOT NULL,                       -- SELECT | INSERT | UPDATE | DELETE
  record_id   TEXT,                                -- id de la ligne visée (texte: parfois non-uuid)
  user_id     UUID REFERENCES public.personnes(id) ON DELETE SET NULL,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour les requêtes d'audit les plus fréquentes.
CREATE INDEX IF NOT EXISTS idx_audit_logs_user    ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table   ON public.audit_logs (table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs (created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- INSERT : un utilisateur authentifié ne peut écrire que des lignes à son nom
-- (empêche de forger des logs pour quelqu'un d'autre).
DROP POLICY IF EXISTS "audit_logs insert own" ON public.audit_logs;
CREATE POLICY "audit_logs insert own"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- SELECT : réservé aux administrateurs.
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

NOTIFY pgrst, 'reload schema';
