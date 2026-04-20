-- Migration 015: flag "published" pour études et missions
ALTER TABLE public.etudes
  ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT false;
