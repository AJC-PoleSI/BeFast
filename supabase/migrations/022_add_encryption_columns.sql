-- Add encrypted data columns to personnes table
ALTER TABLE personnes ADD COLUMN IF NOT EXISTS nss_iv TEXT;
ALTER TABLE personnes ADD COLUMN IF NOT EXISTS nss_auth_tag TEXT;
ALTER TABLE personnes ADD COLUMN IF NOT EXISTS iban_iv TEXT;
ALTER TABLE personnes ADD COLUMN IF NOT EXISTS iban_auth_tag TEXT;
ALTER TABLE personnes ADD COLUMN IF NOT EXISTS adresse_encrypted TEXT;
ALTER TABLE personnes ADD COLUMN IF NOT EXISTS adresse_iv TEXT;
ALTER TABLE personnes ADD COLUMN IF NOT EXISTS adresse_auth_tag TEXT;
ALTER TABLE personnes ADD COLUMN IF NOT EXISTS date_naissance_encrypted TEXT;
ALTER TABLE personnes ADD COLUMN IF NOT EXISTS date_naissance_iv TEXT;
ALTER TABLE personnes ADD COLUMN IF NOT EXISTS date_naissance_auth_tag TEXT;
ALTER TABLE personnes ADD COLUMN IF NOT EXISTS ville_encrypted TEXT;
ALTER TABLE personnes ADD COLUMN IF NOT EXISTS ville_iv TEXT;
ALTER TABLE personnes ADD COLUMN IF NOT EXISTS ville_auth_tag TEXT;
ALTER TABLE personnes ADD COLUMN IF NOT EXISTS code_postal_encrypted TEXT;
ALTER TABLE personnes ADD COLUMN IF NOT EXISTS code_postal_iv TEXT;
ALTER TABLE personnes ADD COLUMN IF NOT EXISTS code_postal_auth_tag TEXT;

-- Add encryption salt column (shared across all encrypted fields for a user)
ALTER TABLE personnes ADD COLUMN IF NOT EXISTS encryption_salt TEXT;

-- Add encrypted data columns to etudes table (budget, notes, client contact info)
ALTER TABLE etudes ADD COLUMN IF NOT EXISTS budget_ht_encrypted TEXT;
ALTER TABLE etudes ADD COLUMN IF NOT EXISTS budget_ht_iv TEXT;
ALTER TABLE etudes ADD COLUMN IF NOT EXISTS budget_ht_auth_tag TEXT;
ALTER TABLE etudes ADD COLUMN IF NOT EXISTS notes_encrypted TEXT;
ALTER TABLE etudes ADD COLUMN IF NOT EXISTS notes_iv TEXT;
ALTER TABLE etudes ADD COLUMN IF NOT EXISTS notes_auth_tag TEXT;
ALTER TABLE etudes ADD COLUMN IF NOT EXISTS encryption_salt TEXT;

-- Add encrypted data columns to missions table (sensitive mission data)
ALTER TABLE missions ADD COLUMN IF NOT EXISTS notes_encrypted TEXT;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS notes_iv TEXT;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS notes_auth_tag TEXT;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS encryption_salt TEXT;
