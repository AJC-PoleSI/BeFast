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
--
-- Limite assumée : la contrainte unique (mission_id, personne_id) impose UN
-- paiement par personne par mission — pas d'acompte + solde, pas de second
-- BV correctif pour la même mission/personne. Un besoin de paiement fractionné
-- devra être traité par une évolution de schéma dédiée, pas contourné en RLS.

CREATE TABLE IF NOT EXISTS public.retributions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE RESTRICT : la policy "missions write" (050) permet à tout
  -- membre interne de supprimer une mission ; avec un CASCADE ici, supprimer
  -- une mission déjà payée effacerait silencieusement l'historique de ses
  -- rétributions. Une mission qui porte des rétributions ne peut donc plus
  -- être supprimée sans traiter (ou réattribuer) ces rétributions d'abord.
  mission_id    UUID NOT NULL REFERENCES public.missions(id)  ON DELETE RESTRICT,
  -- ON DELETE CASCADE conservé : la suppression de compte dans cette
  -- application est un soft delete (lib/account-deletion/), la ligne
  -- `personnes` survit toujours. Ce CASCADE ne se déclencherait que lors
  -- d'une suppression dure de l'utilisateur Auth, que le code ne pratique
  -- volontairement jamais.
  personne_id   UUID NOT NULL REFERENCES public.personnes(id) ON DELETE CASCADE,
  numero_bv     TEXT,
  date_paiement DATE,
  montant       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (montant >= 0),
  notes         TEXT,
  -- Trésorier·ère ayant enregistré EN DERNIER ce paiement : la server action
  -- réécrit cette colonne à chaque upsert, ce n'est donc pas forcément la
  -- personne qui a créé la ligne à l'origine.
  created_by    UUID REFERENCES public.personnes(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT retributions_mission_personne_unique UNIQUE (mission_id, personne_id)
);

-- retributions_mission_id_idx supprimé : redondant avec la colonne de tête
-- de la contrainte unique (mission_id, personne_id), déjà indexée.
CREATE INDEX IF NOT EXISTS retributions_personne_id_idx   ON public.retributions(personne_id);
CREATE INDEX IF NOT EXISTS retributions_date_paiement_idx ON public.retributions(date_paiement);

-- Garde-fou numéro de BV : l'application calcule le prochain numéro comme
-- max + 1 (lib/tresorerie/retributions.ts, nextNumeroBV), donc deux
-- trésoriers qui enregistrent au même instant peuvent produire le même
-- BV-2026-007. L'unicité est PARTIELLE : elle ne porte que sur les numéros
-- au format généré (BV-<année>-<séquence>). Les numéros historiques saisis à
-- la main, hors de ce format, ne sont pas concernés et peuvent légitimement
-- se répéter ou rester vides (NULL n'est jamais contraint par un index
-- unique). L'ancien index simple retributions_numero_bv_idx est retiré : il
-- devenait redondant avec celui-ci pour le cas généré, et aucune requête du
-- code n'ordonne ou ne filtre encore sur ce champ pour les numéros saisis à
-- la main — à réintroduire si un tel besoin apparaît.
CREATE UNIQUE INDEX IF NOT EXISTS retributions_numero_bv_genere_unique
  ON public.retributions(numero_bv)
  WHERE numero_bv ~ '^BV-\d{4}-\d+$';

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Lecture : une rétribution indique qui a été payé, combien et sous quel
-- numéro de BV — plus proche d'un RIB (`voir_rib`, réservé à la trésorerie,
-- migration 055) que d'une facture. Seuls les porteurs de `voir_factures`
-- ont un accès large en lecture. L'intervenant concerné garde en plus un
-- accès à SA propre ligne : droit d'accès RGPD à son propre paiement et à
-- son numéro de BV, que l'ancienne policy (is_membre_interne) lui refusait
-- puisqu'un intervenant n'est jamais membre_interne (migration 050).
--
-- Écriture : INSERT et UPDATE réservés à `voir_factures` (Présidente,
-- Trésorier·ère, Pôle Trésorerie, admins) — même règle que la garde
-- applicative requireVoirFactures — ET à un compte actif (is_compte_actif,
-- migration 061) : sans ce contrôle, un·e trésorier·ère supprimé·e ou
-- suspendu·e garde l'écriture jusqu'à l'expiration de son jeton de session,
-- exactement la faille refermée pour candidatures/notes_de_frais par 061.
--
-- Suppression : réservée aux administrateurs. Un FOR ALL unique laissait
-- n'importe quel porteur de voir_factures (donc aussi le Pôle Trésorerie
-- cumulatif) supprimer purement et simplement un paiement, sans trace
-- d'audit.
ALTER TABLE public.retributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "retributions read"   ON public.retributions;
DROP POLICY IF EXISTS "retributions insert" ON public.retributions;
DROP POLICY IF EXISTS "retributions update" ON public.retributions;
DROP POLICY IF EXISTS "retributions delete" ON public.retributions;

CREATE POLICY "retributions read" ON public.retributions FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'voir_factures') OR personne_id = auth.uid());

CREATE POLICY "retributions insert" ON public.retributions FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission(auth.uid(), 'voir_factures')
    AND public.is_compte_actif(auth.uid())
  );

CREATE POLICY "retributions update" ON public.retributions FOR UPDATE TO authenticated
  USING (
    public.has_permission(auth.uid(), 'voir_factures')
    AND public.is_compte_actif(auth.uid())
  )
  WITH CHECK (
    public.has_permission(auth.uid(), 'voir_factures')
    AND public.is_compte_actif(auth.uid())
  );

CREATE POLICY "retributions delete" ON public.retributions FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- ── candidatures : ouvrir la lecture à la trésorerie ───────────────────────
-- Asymétrie RLS refermée ici. La policy "candidatures read" (migration 050)
-- exigeait `is_membre_interne`, qui n'accepte que les profils de base
-- 'administrateur' | 'membre_ajc' | 'chef_de_projet'. Or `has_permission`
-- (migration 055) accorde aussi `voir_factures` via les postes cumulés
-- (personne_postes — le poste « Pôle Trésorerie » de la migration 064, par
-- exemple). Un·e trésorier·ère dont le profil de base n'est aucun des trois
-- passait donc la garde applicative requireVoirFactures, lisait toutes les
-- rétributions… et ZÉRO candidature : sans erreur, tout le tableau de suivi
-- basculait en « intervenants non sélectionnés » et les personnes déjà payées
-- apparaissaient orphelines.
--
-- La trésorerie a besoin des candidatures acceptées parce qu'elles SONT la
-- liste des personnes à payer sur chaque mission (lib/tresorerie/retributions.ts).
-- Les deux branches historiques sont conservées telles quelles.
-- Rejouable : DROP IF EXISTS puis CREATE.
DROP POLICY IF EXISTS "candidatures read" ON public.candidatures;

CREATE POLICY "candidatures read" ON public.candidatures FOR SELECT TO authenticated
  USING (
    personne_id = auth.uid()
    OR public.is_membre_interne(auth.uid())
    OR public.has_permission(auth.uid(), 'voir_factures')
  );

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
-- Nom de contrainte non requis : robuste si une tentative partielle
-- antérieure a laissé la table dans un état légèrement différent.
ON CONFLICT (mission_id, personne_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';

-- ── Reliquat non repris : missions payées SANS intervenant identifié ───────
-- La reprise ci-dessus ne couvre que missions.intervenant_id IS NOT NULL.
-- Une mission historique payée globalement mais jamais rattachée à un
-- intervenant précis (intervenant_id NULL) n'est PAS backfillée : rien en
-- base ne dit qui a été payé. Si une telle mission a 2 intervenants ou plus
-- via des candidatures acceptées, son paiement reste attribué à personne et
-- ses lignes s'afficheront comme non payées dans le suivi par intervenant
-- (cf. lib/tresorerie/retributions.ts, buildRetributionRows). Requête de
-- contrôle, à exécuter avant/après application pour mesurer le reliquat :
--
-- SELECT count(*) FROM public.missions
-- WHERE (date_paiement IS NOT NULL OR numero_bv IS NOT NULL) AND intervenant_id IS NULL;
