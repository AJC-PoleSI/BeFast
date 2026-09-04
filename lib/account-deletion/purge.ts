/**
 * Anonymisation d'un compte supprimé.
 *
 * La ligne `personnes` n'est jamais effacée : notes_de_frais,
 * mission_collaborations et candidatures cascadent depuis elle (migrations 005
 * et 025), et personnes.id cascade lui-même depuis auth.users. On la vide de
 * tout ce qui est personnel ; l'historique des missions et des frais reste
 * intact.
 */

export const DELETED_STATUS = "deleted"
export const DELETED_PRENOM = "Compte"
export const DELETED_NOM = "supprimé"

/** Adresse technique unique, d'où l'on ne peut pas remonter à l'adresse réelle. */
export function anonymisedEmailFor(personneId: string): string {
  return `supprime+${personneId}@ajc-mail.com`
}

/** Familles de colonnes chiffrées de `personnes` (migration 022). */
const ENCRYPTED_FIELDS = [
  "nss",
  "iban",
  "adresse",
  "date_naissance",
  "ville",
  "code_postal",
] as const

export function buildAnonymisationPatch(personneId: string): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    account_status: DELETED_STATUS,
    prenom: DELETED_PRENOM,
    nom: DELETED_NOM,
    email: anonymisedEmailFor(personneId),
    portable: null,
    avatar_url: null,
    encryption_salt: null,
    // Colonnes en clair héritées des versions antérieures au chiffrement.
    adresse: null,
    ville: null,
    code_postal: null,
    date_naissance: null,
  }

  for (const champ of ENCRYPTED_FIELDS) {
    patch[`${champ}_encrypted`] = null
    patch[`${champ}_iv`] = null
    patch[`${champ}_auth_tag`] = null
  }

  return patch
}
