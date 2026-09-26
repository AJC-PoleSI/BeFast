-- 073_document_bulletin_adhesion.sql
-- Nouvel emplacement de justificatif : le bulletin d'adhésion signé, que la
-- personne renvoie après l'avoir reçu par mail. Même mécanisme que les autres
-- pièces : une ligne de documents_personnes par (personne, type).
--
-- À appliquer AVANT de déployer le code qui propose la case, sinon chaque
-- dépôt de BA est refusé par la contrainte (cf. 071 : incident du 21/09/2026).
-- Contrainte de départ vérifiée en prod le 24/09/2026 : les six types de la 071.
-- Idempotent : ré-exécuter ne casse rien.

ALTER TABLE public.documents_personnes
  DROP CONSTRAINT IF EXISTS documents_personnes_type_check;

ALTER TABLE public.documents_personnes
  ADD CONSTRAINT documents_personnes_type_check
  CHECK (type IN (
    'carte_identite_recto',
    'carte_identite_verso',
    'carte_etudiante',
    'carte_vitale',
    'preuve_lydia',
    'rib',
    'bulletin_adhesion'
  ));
