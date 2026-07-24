-- Migration 047: ajoute la colonne 'commentaire' manquante sur etudes
-- (utilisée par lib/actions/etudes.ts et le formulaire d'étude depuis longtemps,
-- mais jamais créée en base -> erreur "Could not find the 'commentaire' column")

ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS commentaire TEXT;
