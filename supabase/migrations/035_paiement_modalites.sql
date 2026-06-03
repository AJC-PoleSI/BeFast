-- Migration 035 : modalités de règlement configurables sur les propositions.
--
-- Stocke le schéma de versements choisi par le chef de projet (et ajustable par
-- la trésorerie lors de la validation) sous forme JSON :
--   {
--     "type": "standard" | "pvri",
--     "versements": [
--       { "label": "Acompte à la signature", "pct": 40 },
--       { "label": "PV de règlement intermédiaire", "pct": 30 },
--       { "label": "Solde au PV de recette", "pct": 30 }
--     ]
--   }
-- Quand la colonne est NULL, l'application retombe sur le schéma standard 60/40.

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS paiement_modalites JSONB;
