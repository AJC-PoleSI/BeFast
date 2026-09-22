-- 071_carte_identite_recto_verso.sql
-- La carte d'identité française a deux faces (recto/verso) mais Be Fast ne
-- proposait qu'un seul emplacement d'upload pour le type 'carte_identite'.
--
-- On remplace ce type unique par deux types distincts, réutilisant le
-- mécanisme existant "un upload = une ligne de documents_personnes.type" :
--   - carte_identite_recto
--   - carte_identite_verso
--
-- Les documents déjà uploadés sous 'carte_identite' sont conservés comme
-- recto (déjà en base, souvent la seule face fournie) ; les membres devront
-- uploader le verso séparément.

ALTER TABLE public.documents_personnes
  DROP CONSTRAINT IF EXISTS documents_personnes_type_check;

UPDATE public.documents_personnes
SET type = 'carte_identite_recto'
WHERE type = 'carte_identite';

ALTER TABLE public.documents_personnes
  ADD CONSTRAINT documents_personnes_type_check
  CHECK (type IN (
    'carte_identite_recto',
    'carte_identite_verso',
    'carte_etudiante',
    'carte_vitale',
    'preuve_lydia',
    'rib'
  ));
