import type { PersonneWithRole, Permissions, PermissionKey } from "@/types/database.types"

/** Toutes les clés de permission connues (source de vérité runtime). */
export const ALL_PERMISSION_KEYS: PermissionKey[] = [
  "dashboard", "profil", "missions", "etudes", "prospection", "statistiques",
  "administration", "membres", "documents", "nouvelle_mission",
  "voir_documents_membres", "voir_nss", "voir_rib",
  "assigner_intervenants", "modifier_etudes", "parametres_structure",
  "selectionner_candidats", "valider_comptes", "valider_bv", "voir_factures",
  "gerer_parametres", "publier_etudes", "publier_missions",
  "signer_documents", "signer_ba",
]

/** Objet permissions entièrement à false. */
export function emptyPermissions(): Permissions {
  return Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, false])) as Permissions
}

/**
 * Permissions effectives = OR clé-par-clé du rôle de base et de tous les postes
 * (bureau/pôles) assignés. Une source manquante (poste sans profils_types, etc.)
 * est ignorée sans erreur.
 */
export function resolveEffectivePermissions(profile: PersonneWithRole | null): Permissions {
  if (!profile) return emptyPermissions()
  if (profile.profils_types?.slug === "administrateur") {
    return Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, true])) as Permissions
  }
  const perms = emptyPermissions()
  const sources: Array<Partial<Permissions> | null | undefined> = [
    profile.profils_types?.permissions,
    ...(profile.personne_postes ?? []).map((pp) => pp.profils_types?.permissions),
  ]
  for (const src of sources) {
    if (!src) continue
    for (const k of ALL_PERMISSION_KEYS) {
      if ((src as Record<string, unknown>)[k] === true) perms[k] = true
    }
  }
  return perms
}

/** L'administrateur a tout ; sinon on lit les permissions effectives. */
export function hasPermission(profile: PersonneWithRole | null, key: PermissionKey): boolean {
  if (profile?.profils_types?.slug === "administrateur") return true
  return resolveEffectivePermissions(profile)[key] === true
}

/** Étude telle qu'attendue par les gardes ci-dessous. */
type EtudeAcces = {
  created_by: string | null
  /** Suiveurs (= chefs de projet) rattachés à l'étude, si la liste est connue. */
  suiveurs?: { id: string }[] | null
}

/** `true` si la personne est suiveur (chef de projet) de l'étude. */
export function estSuiveurEtude(
  profile: PersonneWithRole | null,
  etude: EtudeAcces
): boolean {
  if (!profile) return false
  return (etude.suiveurs ?? []).some((s) => s.id === profile.id)
}

/**
 * Modification d'une étude : l'administrateur, le créateur de l'étude, ses
 * suiveurs (chefs de projet), et les postes disposant de la permission
 * `modifier_etudes` (ex. Pôle SI).
 *
 * Le suiveur est inclus parce que gérer l'étude EST le travail du chef de
 * projet : créer les missions intervenants, générer les documents. Sans lui,
 * être désigné chef de projet ne donnait aucun droit sur l'étude suivie.
 *
 * `etude.suiveurs` est optionnel : un appelant qui ne charge pas la liste
 * retombe sur l'ancien comportement (créateur / permission) au lieu de
 * planter — mais il refusera alors un suiveur légitime.
 */
export function canEditEtude(
  profile: PersonneWithRole | null,
  etude: EtudeAcces
): boolean {
  if (!profile) return false
  if (profile.profils_types?.slug === "administrateur") return true
  if (etude.created_by && etude.created_by === profile.id) return true
  if (estSuiveurEtude(profile, etude)) return true
  return hasPermission(profile, "modifier_etudes")
}

/**
 * Suppression d'une étude : plus restrictif que la modification — le suiveur
 * n'en fait PAS partie. Reprend exactement la policy RLS `etudes delete`
 * (migration 056) : admin, créateur, `modifier_etudes`. Sans cette distinction,
 * l'UI afficherait au chef de projet un bouton Supprimer que Postgres refuse.
 */
export function canDeleteEtude(
  profile: PersonneWithRole | null,
  etude: EtudeAcces
): boolean {
  if (!profile) return false
  if (profile.profils_types?.slug === "administrateur") return true
  if (etude.created_by && etude.created_by === profile.id) return true
  return hasPermission(profile, "modifier_etudes")
}
