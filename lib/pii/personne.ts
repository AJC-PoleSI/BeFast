import "server-only"

import { decryptData, encryptData } from "../crypto"
import { getMasterKey } from "../crypto-key"
import { decryptFromString } from "../encryption"

/**
 * Données personnelles de `personnes` stockées chiffrées (AES-GCM, clé dérivée
 * de ENCRYPTION_MASTER_KEY + `encryption_salt` propre à la personne), dans les
 * colonnes `<champ>_encrypted`, `<champ>_iv`, `<champ>_auth_tag`.
 *
 * La colonne en clair du même nom ne doit plus rien contenir : jusqu'au
 * 26/09/2026, le formulaire de profil écrivait les deux versions, et l'import
 * Be Quick seulement la version en clair.
 */
export const CHAMPS_PII = ["adresse", "ville", "code_postal", "date_naissance"] as const
export type ChampPII = (typeof CHAMPS_PII)[number]
export type ValeursPII = Record<ChampPII, string | null>

/** Colonnes à ajouter à un `select` explicite pour pouvoir appeler `lirePII`. */
export const COLONNES_PII = [
  "encryption_salt",
  ...CHAMPS_PII.flatMap((c) => [c, `${c}_encrypted`, `${c}_iv`, `${c}_auth_tag`]),
].join(", ")

/** Colonnes techniques du chiffrement, à ne jamais exposer telles quelles. */
const COLONNES_CHIFFREMENT = new Set([
  "encryption_salt",
  "encryption_key_version",
  ...["nss", "iban", ...CHAMPS_PII].flatMap((c) => [`${c}_encrypted`, `${c}_iv`, `${c}_auth_tag`]),
])

function vide(v: unknown): boolean {
  return v == null || String(v).trim() === ""
}

/**
 * Valeurs en clair des données personnelles d'une ligne `personnes`.
 *
 * La version chiffrée fait foi. La colonne en clair ne sert que de repli pour
 * une ligne pas encore chiffrée. Ne lève jamais : une valeur indéchiffrable
 * vaut `null` (et est journalisée), pour ne pas faire échouer toute une page.
 */
export function lirePII(row: Record<string, any> | null | undefined): ValeursPII {
  const valeurs = {} as ValeursPII
  const sel: string | null = row?.encryption_salt ?? null
  let cle: string | null = null

  for (const champ of CHAMPS_PII) {
    const chiffre = row?.[`${champ}_encrypted`]
    const iv = row?.[`${champ}_iv`]
    const tag = row?.[`${champ}_auth_tag`]
    if (chiffre && iv && tag && sel) {
      try {
        cle ??= getMasterKey()
        valeurs[champ] = decryptData(chiffre, iv, tag, cle, sel)
        continue
      } catch (e) {
        console.error(`[pii] ${champ} indéchiffrable pour ${row?.id ?? "?"}:`, (e as Error)?.message)
        valeurs[champ] = null
        continue
      }
    }
    const clair = row?.[champ]
    valeurs[champ] = vide(clair) ? null : String(clair)
  }
  return valeurs
}

/**
 * Ligne `personnes` prête à exposer (contexte de document, réponse d'API) :
 * données personnelles déchiffrées sous leur nom usuel, colonnes techniques du
 * chiffrement retirées.
 */
export function avecPIIEnClair<T extends Record<string, any>>(row: T): Omit<T, ChampPII> & ValeursPII {
  const sortie: Record<string, any> = {}
  for (const [k, v] of Object.entries(row)) {
    if (!COLONNES_CHIFFREMENT.has(k)) sortie[k] = v
  }
  return Object.assign(sortie, lirePII(row)) as Omit<T, ChampPII> & ValeursPII
}

/**
 * Colonnes à écrire pour enregistrer des données personnelles : la version
 * chiffrée, et TOUJOURS la colonne en clair vidée.
 *  - `undefined` : champ non modifié (rien n'est écrit) ;
 *  - `null` ou chaîne vide : champ effacé (versions chiffrée et en clair).
 */
export function colonnesPII(
  valeurs: Partial<Record<ChampPII, string | null | undefined>>,
  sel: string
): Record<string, string | null> {
  const colonnes: Record<string, string | null> = {}
  let cle: string | null = null
  for (const champ of CHAMPS_PII) {
    const v = valeurs[champ]
    if (v === undefined) continue
    colonnes[champ] = null
    if (vide(v)) {
      colonnes[`${champ}_encrypted`] = null
      colonnes[`${champ}_iv`] = null
      colonnes[`${champ}_auth_tag`] = null
    } else {
      cle ??= getMasterKey()
      const enc = encryptData(String(v).trim(), cle, sel)
      colonnes[`${champ}_encrypted`] = enc.encrypted
      colonnes[`${champ}_iv`] = enc.iv
      colonnes[`${champ}_auth_tag`] = enc.authTag
    }
  }
  return colonnes
}

/**
 * NSS ou IBAN en clair. Deux formats coexistent en base : trois colonnes
 * `<champ>_encrypted` / `_iv` / `_auth_tag` (lib/crypto, clé maître + sel) et
 * une seule chaîne « iv:tag:chiffré » dans `<champ>_encrypted` (lib/encryption,
 * import Be Quick et /api/profil/sensitive — au 26/09/2026, tous les NSS et
 * IBAN présents sont dans ce second format). `null` si absent ou illisible.
 */
export function lireSecret(row: Record<string, any> | null | undefined, champ: "nss" | "iban"): string | null {
  const chiffre = row?.[`${champ}_encrypted`]
  if (!chiffre) return null
  try {
    const iv = row?.[`${champ}_iv`]
    const tag = row?.[`${champ}_auth_tag`]
    if (iv && tag && row?.encryption_salt) {
      return decryptData(chiffre, iv, tag, getMasterKey(), row.encryption_salt)
    }
    return decryptFromString(chiffre)
  } catch (e) {
    console.error(`[pii] ${champ} indéchiffrable pour ${row?.id ?? "?"}:`, (e as Error)?.message)
    return null
  }
}
