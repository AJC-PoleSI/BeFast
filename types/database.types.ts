export type PermissionKey =
  | "dashboard"
  | "profil"
  | "missions"
  | "etudes"
  | "prospection"
  | "statistiques"
  | "administration"
  | "documents"

export type Permissions = Record<PermissionKey, boolean>

export interface ProfilType {
  id: string
  nom: string
  slug: string
  permissions: Permissions
  est_defaut: boolean
  created_at: string
  updated_at: string
}

export interface Personne {
  id: string
  email: string
  prenom: string | null
  nom: string | null
  portable: string | null
  promo: string | null
  adresse: string | null
  ville: string | null
  code_postal: string | null
  pole: string | null
  nss_encrypted: string | null
  iban_encrypted: string | null
  encryption_key_version: number
  profil_type_id: string | null
  avatar_url: string | null
  actif: boolean
  created_at: string
  updated_at: string
}

export interface PersonneWithRole extends Personne {
  profils_types: ProfilType | null
}

export type DocumentType =
  | "carte_identite"
  | "carte_etudiante"
  | "carte_vitale"
  | "preuve_lydia"
  | "rib"

export interface DocumentPersonne {
  id: string
  personne_id: string
  type: DocumentType
  file_path: string
  file_name: string
  file_size: number | null
  mime_type: string | null
  created_at: string
  updated_at: string
}

export interface NavItem {
  label: string
  href: string
  icon: string
  permission: PermissionKey
}
