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
  const perms = emptyPermissions()
  if (!profile) return perms
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

// Permissions exclues du bypass administrateur : l'accès reste conditionné au
// rôle/poste réel même pour un compte administrateur. Cas actuel : la
// Trésorerie (factures, RIB de la structure) ne doit être visible qu'aux
// personnes tenant effectivement le poste Trésorier·ère ou Pôle Trésorerie —
// un administrateur système n'y a pas accès de facto (demande explicite,
// 2026-09-08).
const PERMISSIONS_SANS_BYPASS_ADMIN: ReadonlySet<PermissionKey> = new Set(["voir_factures"])

/** L'administrateur a tout, sauf les clés de PERMISSIONS_SANS_BYPASS_ADMIN. */
export function hasPermission(profile: PersonneWithRole | null, key: PermissionKey): boolean {
  if (profile?.profils_types?.slug === "administrateur" && !PERMISSIONS_SANS_BYPASS_ADMIN.has(key)) {
    return true
  }
  return resolveEffectivePermissions(profile)[key] === true
}

/**
 * Modification d'une étude : l'administrateur, le créateur de l'étude, et
 * les postes disposant de la permission `modifier_etudes` (ex. Pôle SI).
 */
export function canEditEtude(
  profile: PersonneWithRole | null,
  etude: { created_by: string | null }
): boolean {
  if (!profile) return false
  if (profile.profils_types?.slug === "administrateur") return true
  if (etude.created_by && etude.created_by === profile.id) return true
  return hasPermission(profile, "modifier_etudes")
}
