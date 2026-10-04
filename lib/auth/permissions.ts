import type { PersonneWithRole, Permissions, PermissionKey } from "@/types/database.types"

/** Toutes les clés de permission connues (source de vérité runtime). */
export const ALL_PERMISSION_KEYS: PermissionKey[] = [
  "dashboard", "profil", "missions", "etudes", "prospection", "statistiques",
  "administration", "membres", "documents", "nouvelle_mission",
  "voir_documents_membres", "voir_nss", "voir_rib",
  "assigner_intervenants", "modifier_etudes", "parametres_structure",
  "selectionner_candidats", "valider_comptes", "changer_roles", "valider_bv", "voir_factures",
  "gerer_parametres", "publier_etudes", "publier_missions",
  "signer_documents", "signer_ba",
]

/** Objet permissions entièrement à false. */
export function emptyPermissions(): Permissions {
  return Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, false])) as Permissions
}

/**
 * Clés laissées à un compte qui n'est pas (encore) validé : il peut compléter
 * son profil et déposer ses justificatifs, rien d'autre.
 */
const CLES_COMPTE_NON_VALIDE: PermissionKey[] = ["profil", "documents"]

/** `true` si le compte n'est pas validé (en attente, refusé, supprimé). */
export function estCompteRestreint(profile: PersonneWithRole | null): boolean {
  if (!profile) return false
  if (profile.profils_types?.slug === "administrateur") return false
  return profile.account_status !== "validated"
}

/**
 * Permissions effectives = OR clé-par-clé du rôle de base et de tous les postes
 * (bureau/pôles) assignés. Une source manquante (poste sans profils_types, etc.)
 * est ignorée sans erreur.
 *
 * Un compte non validé est ramené à `profil` + `documents` : la restriction
 * était auparavant appliquée uniquement dans `app/(dashboard)/layout.tsx`, donc
 * seulement à l'affichage — les gardes serveur (API, server actions, pages)
 * voyaient les permissions complètes d'un compte en attente de validation.
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
  if (estCompteRestreint(profile)) {
    const restreint = emptyPermissions()
    for (const k of CLES_COMPTE_NON_VALIDE) restreint[k] = perms[k]
    return restreint
  }
  return perms
}

/** L'administrateur a tout ; sinon on lit les permissions effectives. */
export function hasPermission(profile: PersonneWithRole | null, key: PermissionKey): boolean {
  if (profile?.profils_types?.slug === "administrateur") return true
  return resolveEffectivePermissions(profile)[key] === true
}

/** Au moins une des clés (utile pour les espaces à plusieurs portes d'entrée). */
export function hasAnyPermission(
  profile: PersonneWithRole | null,
  keys: PermissionKey[]
): boolean {
  return keys.some((k) => hasPermission(profile, k))
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
  if (estCompteRestreint(profile)) return false
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
  if (estCompteRestreint(profile)) return false
  if (etude.created_by && etude.created_by === profile.id) return true
  return hasPermission(profile, "modifier_etudes")
}

/**
 * Changement du rôle de base d'un membre (Candidat, Intervenant, Membre AJC…).
 *
 * Ouvert aux porteurs de `changer_roles`, avec trois garde-fous pour qu'une
 * délégation à un poste ne devienne pas une prise de pouvoir : seul un
 * administrateur nomme ou retire un administrateur, et personne d'autre que
 * lui ne change son propre rôle.
 */
export function canChangeMemberRole(
  profile: PersonneWithRole | null,
  cible: { id: string; roleActuel: string | null; nouveauRole: string }
): { ok: true } | { ok: false; error: string } {
  if (!profile) return { ok: false, error: "Non authentifié" }
  if (profile.profils_types?.slug === "administrateur") return { ok: true }
  if (!hasPermission(profile, "changer_roles")) {
    return { ok: false, error: "Vous n'avez pas la permission de changer le rôle d'un membre." }
  }
  if (cible.id === profile.id) {
    return { ok: false, error: "Vous ne pouvez pas modifier votre propre rôle." }
  }
  if (cible.roleActuel === "administrateur" || cible.nouveauRole === "administrateur") {
    return { ok: false, error: "Seul un administrateur peut nommer ou retirer un administrateur." }
  }
  return { ok: true }
}
