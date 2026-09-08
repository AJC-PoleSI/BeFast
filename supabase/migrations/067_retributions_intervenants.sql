-- 067_retributions_intervenants.sql
--
-- Suivi du versement des rétributions INTERVENANT PAR INTERVENANT.
-- Jusqu'ici le paiement vivait sur `missions` (date_paiement / numero_bv) :
-- une mission portée par 26 intervenants n'avait qu'un seul statut de paiement,
-- impossible de savoir qui avait été payé.
--
-- La table ne contient que les lignes déjà traitées (BV émis ou paiement
-- enregistré) : la liste des intervenants d'une mission reste dérivée des
-- candidatures acceptées + missions.intervenant_id.
--
-- Les colonnes missions.date_paiement / numero_bv sont CONSERVÉES : elles
-- restent le seul moyen de tracer une mission sans intervenant sélectionné.

CREATE TABLE IF NOT EXISTS public.retributions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id    UUID NOT NULL REFERENCES public.missions(id)  ON DELETE CASCADE,
  personne_id   UUID NOT NULL REFERENCES public.personnes(id) ON DELETE CASCADE,
  numero_bv     TEXT,
  date_paiement DATE,
  montant       NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes         TEXT,
  created_by    UUID REFERENCES public.personnes(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT retributions_mission_personne_unique UNIQUE (mission_id, personne_id)
);

CREATE INDEX IF NOT EXISTS retributions_mission_id_idx    ON public.retributions(mission_id);
CREATE INDEX IF NOT EXISTS retributions_personne_id_idx   ON public.retributions(personne_id);
CREATE INDEX IF NOT EXISTS retributions_date_paiement_idx ON public.retributions(date_paiement);
-- Index NON unique : des paiements historiques peuvent partager un numéro.
-- L'unicité est vérifiée par la server action, avec un message explicite.
CREATE INDEX IF NOT EXISTS retributions_numero_bv_idx     ON public.retributions(numero_bv);

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Lecture : membres internes. Écriture : porteurs de `voir_factures`
-- (Présidente, Trésorier·ère, Pôle Trésorerie, admins) — même règle que la
-- garde applicative requireVoirFactures.
ALTER TABLE public.retributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "retributions read"   ON public.retributions;
DROP POLICY IF EXISTS "retributions write"  ON public.retributions;
DROP POLICY IF EXISTS "retributions delete" ON public.retributions;

CREATE POLICY "retributions read" ON public.retributions FOR SELECT TO authenticated
  USING (public.is_membre_interne(auth.uid()));

CREATE POLICY "retributions write" ON public.retributions FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'voir_factures'))
  WITH CHECK (public.has_permission(auth.uid(), 'voir_factures'));

-- ── updated_at ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_retributions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS retributions_updated_at_trigger ON public.retributions;
CREATE TRIGGER retributions_updated_at_trigger
  BEFORE UPDATE ON public.retributions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_retributions_updated_at();

-- ── Reprise de l'historique ────────────────────────────────────────────────
-- Chaque mission déjà payée et dotée d'un intervenant identifié devient une
-- ligne de rétribution, pour ne pas perdre les paiements saisis. Rejouable.
INSERT INTO public.retributions (mission_id, personne_id, numero_bv, date_paiement, montant)
SELECT
  m.id,
  m.intervenant_id,
  m.numero_bv,
  m.date_paiement,
  ROUND(COALESCE(m.remuneration, 0) * COALESCE(m.nb_jeh, 0), 2)
FROM public.missions m
WHERE m.intervenant_id IS NOT NULL
  AND (m.date_paiement IS NOT NULL OR m.numero_bv IS NOT NULL)
ON CONFLICT ON CONSTRAINT retributions_mission_personne_unique DO NOTHING;

NOTIFY pgrst, 'reload schema';
