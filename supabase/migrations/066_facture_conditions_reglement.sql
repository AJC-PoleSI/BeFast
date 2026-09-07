-- Migration 066 : conditions de règlement propres à chaque facture.
--
-- « A réception de facture » était écrit en dur dans le modèle Word, alors que
-- c'est une donnée qui change d'une facture à l'autre (à réception, 30 jours,
-- 45 jours fin de mois…). Elle devient une colonne de `factures`, exposée au
-- modèle par {facturation.conditions_reglement}. Vide → valeur par défaut du
-- paramètre `conditions_reglement_defaut`.

ALTER TABLE public.factures
  ADD COLUMN IF NOT EXISTS conditions_reglement TEXT;

COMMENT ON COLUMN public.factures.conditions_reglement IS
  'Conditions de règlement imprimées sur la facture. NULL → paramètre conditions_reglement_defaut.';

-- Mentions légales et d'identité sorties du corps figé du modèle de facture.
-- Elles ne changent pas à chaque facture mais à chaque exercice / mandat, et
-- doivent être éditables depuis Administration → Structure.
INSERT INTO public.parametres (key, value)
VALUES
  ('affiliation',                 'affiliée à la CNJE'),
  ('conditions_reglement_defaut', 'A réception de facture'),
  ('mention_escompte',            'Aucun escompte n''est accordé en cas de paiement anticipé'),
  ('regime_tva',                  'TVA sur les encaissements'),
  ('taux_penalites',              '3 fois le taux d''intérêt légal en vigueur'),
  ('indemnite_recouvrement',      '40 euros')
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
