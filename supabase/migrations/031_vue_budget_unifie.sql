-- ============================================================
-- Migration 031 : Vue unifiée du budget (lecture seule)
-- Réconcilie les 3 couches de "JEH" sous un vocabulaire canonique,
-- SANS renommer/casser les tables existantes (non destructif).
--
-- Convention (validée avec Baptiste) :
--   JEH = unité de facturation.
--   nb_jeh      = nombre de JEH (quantité)
--   prix_jeh    = prix unitaire d'un JEH (€)
--   montant_ht  = nb_jeh * prix_jeh
-- ============================================================

CREATE OR REPLACE VIEW public.v_budget_unifie AS
-- Couche NÉGOCIÉ : phases des propositions commerciales
SELECT
  'negocie'::text                         AS source,
  pp.proposal_id::text                    AS ref_id,
  'proposal'::text                        AS ref_type,
  pp.name                                 AS phase,
  COALESCE(pp.jeh_count, 0)::numeric      AS nb_jeh,
  COALESCE(pp.jeh_price, 0)::numeric      AS prix_jeh,
  (COALESCE(pp.jeh_count,0) * COALESCE(pp.jeh_price,0))::numeric AS montant_ht,
  pr.marge_je::numeric                    AS marge_pct
FROM public.proposal_phases pp
LEFT JOIN public.proposals pr ON pr.id = pp.proposal_id

UNION ALL

-- Couche RÉALISÉ : budget effectif enregistré par étude
SELECT
  'realise'::text                         AS source,
  be.etude_id::text                       AS ref_id,
  'etude'::text                           AS ref_type,
  be.phase                                AS phase,
  COALESCE(be.nb_jeh, 0)::numeric         AS nb_jeh,
  COALESCE(be.prix_jeh, 0)::numeric       AS prix_jeh,
  (COALESCE(be.nb_jeh,0) * COALESCE(be.prix_jeh,0))::numeric AS montant_ht,
  be.marge_pct::numeric                   AS marge_pct
FROM public.budget_etude be

UNION ALL

-- Couche EXÉCUTION : missions réelles
SELECT
  'mission'::text                         AS source,
  m.etude_id::text                        AS ref_id,
  'etude'::text                           AS ref_type,
  m.nom                                   AS phase,
  COALESCE(m.nb_jeh, 0)::numeric          AS nb_jeh,
  COALESCE(m.taux_jour, 0)::numeric       AS prix_jeh,
  (COALESCE(m.nb_jeh,0) * COALESCE(m.taux_jour,0))::numeric AS montant_ht,
  NULL::numeric                           AS marge_pct
FROM public.missions m;
