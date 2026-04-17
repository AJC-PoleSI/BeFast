export type PermissionKey =
  | "dashboard"
  | "profil"
  | "missions"
  | "etudes"
  | "prospection"
  | "statistiques"
  | "administration"
  | "membres"
  | "documents"
  | "nouvelle_mission"
  | "voir_documents_membres"

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
  etablissement: "Audencia Nantes" | "Audencia Bachelor" | "Audencia Paris" | null
  scolarite: "Pré-Master" | "Master 1" | "Master 2" | null
  date_naissance: string | null // ISO date format YYYY-MM-DD
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

// ---- Phase 3 & 4 types ----

export type ClientType = "ao" | "cs" | "prospection"

export interface Client {
  id: string
  nom: string
  email: string | null
  telephone: string | null
  type: ClientType
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type EtudeStatut =
  | "prospection"
  | "en_cours_prospection"
  | "signee"
  | "en_cours"
  | "terminee"

export interface Etude {
  id: string
  nom: string
  numero: string
  client_id: string | null
  suiveur_id: string | null
  budget: number | null
  commentaire: string | null
  statut: EtudeStatut
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface EtudeWithRelations extends Etude {
  clients: Client | null
  suiveur: Pick<Personne, "id" | "prenom" | "nom" | "email"> | null
}

export type MissionType = "chef_projet" | "intervenant"
export type MissionVoie = "finance" | "marketing" | "audit" | "rse"
export type MissionClasse = "premaster" | "m1" | "m2"
export type MissionStatut = "ouverte" | "pourvue" | "terminee" | "annulee"

export interface Mission {
  id: string
  etude_id: string | null
  nom: string
  description: string | null
  type: MissionType
  voie: MissionVoie | null
  classe: MissionClasse | null
  langues: string[]
  date_debut: string | null
  date_fin: string | null
  remuneration: number | null
  nb_jeh: number
  nb_intervenants: number
  statut: MissionStatut
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface MissionWithEtude extends Mission {
  etudes: Pick<Etude, "id" | "nom" | "numero"> | null
}

export type CandidatureStatut = "en_attente" | "acceptee" | "refusee"

export interface Candidature {
  id: string
  mission_id: string
  personne_id: string
  motivation: string
  classe: MissionClasse | null
  langues: { langue: string; niveau: string }[]
  statut: CandidatureStatut
  reponse_date: string | null
  created_at: string
  updated_at: string
}

export interface CandidatureWithPersonne extends Candidature {
  personnes: Pick<Personne, "id" | "prenom" | "nom" | "email" | "promo"> | null
}

export interface CandidatureWithMission extends Candidature {
  missions: Pick<Mission, "id" | "nom" | "statut"> | null
}

export interface EcheancierBloc {
  id: string
  etude_id: string
  nom: string
  semaine_debut: number
  duree_semaines: number
  jeh: number
  couleur: string
  ordre: number
  created_at: string
  updated_at: string
}

export interface NavItem {
  label: string
  href: string
  icon: string
  permission: PermissionKey
}

export type CustomFieldType = "text" | "select" | "date" | "number"

export interface CustomField {
  id: string
  name: string
  slug: string
  type: CustomFieldType
  required: boolean
  options: { values: string[] } | null
  description: string | null
  ordre: number
  created_at: string
  updated_at: string
}

export interface CustomFieldValue {
  id: string
  user_id: string
  field_id: string
  value: string | null
  created_at: string
  updated_at: string
}
