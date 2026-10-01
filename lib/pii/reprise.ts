import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { generateEncryptionSalt } from "../crypto"
import { CHAMPS_PII, colonnesPII, lirePII, type ChampPII } from "./personne"

/**
 * Reprise des données personnelles de `personnes` restées en clair (adresse,
 * ville, code postal, date de naissance, et `date_of_birth` de l'inscription
 * candidat). Au 26/09/2026 : ~620 profils importés de Be Quick n'avaient QUE la
 * version en clair, 56 avaient les deux.
 *
 *  - `chiffrer` : écrit la version chiffrée de ce qui n'existe qu'en clair
 *                 (et `date_of_birth` → `date_naissance`). N'efface rien ;
 *  - `vider`    : vide les colonnes en clair dont la version chiffrée relit
 *                 exactement la même valeur. DESTRUCTIF, et seulement après le
 *                 déploiement du code qui lit les versions chiffrées.
 * Sans `ecrire`, rien n'est écrit : le bilan dit ce qui serait fait.
 *
 * Doit tourner avec la clé maître de PRODUCTION : chiffrer avec une autre clé
 * rendrait les valeurs illisibles pour l'application. Garde-fou : si une seule
 * valeur déjà chiffrée en base ne se relit pas avec la clé en place, rien
 * n'est écrit.
 *
 * `limite` borne le nombre de profils écrits par appel (dérivation PBKDF2
 * coûteuse) : relancer jusqu'à `restants = 0`.
 */
export type ModeReprise = "chiffrer" | "vider"

export interface BilanReprise {
  mode: ModeReprise
  ecrit: boolean
  profils: number
  /** Profils concernés par ce mode (avant cet appel). */
  aTraiter: number
  /** Profils écrits par cet appel. */
  traites: number
  /** Profils encore à traiter après cet appel. */
  restants: number
  valeursAChiffrer: number
  dateOfBirthRepris: number
  clairVidable: number
  clairDivergent: number
  /** Valeurs chiffrées en base que la clé en place ne relit pas. */
  indechiffrables: number
}

type Ligne = Record<string, any>

const COLONNES = [
  "id", "encryption_salt", "date_of_birth",
  ...CHAMPS_PII.flatMap((c) => [c, `${c}_encrypted`, `${c}_iv`, `${c}_auth_tag`]),
].join(", ")

const norm = (v: unknown) => (v == null ? "" : String(v).trim())
/** `date` Postgres → « AAAA-MM-JJ », comme la valeur chiffrée. */
const normDate = (v: unknown) => norm(v).slice(0, 10)
const normChamp = (champ: ChampPII, v: unknown) => (champ === "date_naissance" ? normDate(v) : norm(v))

/** Colonnes à écrire pour un profil, ou `null` s'il n'y a rien à faire. */
function patchPour(
  p: Ligne,
  lu: Record<ChampPII, string | null>,
  mode: ModeReprise,
  ecrire: boolean,
  bilan: BilanReprise
) {
  const patch: Record<string, unknown> = {}

  if (mode === "vider") {
    for (const champ of CHAMPS_PII) {
      if (norm(p[champ]) === "" || !p[`${champ}_encrypted`] || lu[champ] == null) continue
      if (normChamp(champ, p[champ]) === normChamp(champ, lu[champ])) {
        patch[champ] = null
        bilan.clairVidable++
      } else {
        bilan.clairDivergent++
      }
    }
    // `date_of_birth` : vidé dès qu'une date de naissance chiffrée existe.
    if (p.date_of_birth && p.date_naissance_encrypted && lu.date_naissance) {
      patch.date_of_birth = null
      bilan.clairVidable++
    }
    return Object.keys(patch).length ? patch : null
  }

  const valeurs: Partial<Record<ChampPII, string>> = {}
  for (const champ of CHAMPS_PII) {
    if (p[`${champ}_encrypted`] || norm(p[champ]) === "") continue
    valeurs[champ] = normChamp(champ, p[champ])
    bilan.valeursAChiffrer++
  }
  if (!p.date_naissance_encrypted && norm(p.date_naissance) === "" && p.date_of_birth) {
    valeurs.date_naissance = normDate(p.date_of_birth)
    bilan.dateOfBirthRepris++
  }
  if (!Object.keys(valeurs).length) return null
  if (!ecrire) return patch

  const sel: string = p.encryption_salt || generateEncryptionSalt()
  // colonnesPII vide aussi la colonne en clair : on ne garde ici que la
  // version chiffrée, l'effacement est le mode `vider`.
  const cols = colonnesPII(valeurs, sel)
  for (const champ of CHAMPS_PII) delete cols[champ]
  Object.assign(patch, cols)
  if (!p.encryption_salt) patch.encryption_salt = sel

  // Contrôle avant écriture : le chiffré doit redonner la valeur d'origine.
  const relu = lirePII({ id: p.id, encryption_salt: sel, ...cols })
  for (const [champ, attendu] of Object.entries(valeurs)) {
    if (normChamp(champ as ChampPII, relu[champ as ChampPII]) !== attendu) {
      throw new Error(`${p.id} : le chiffrement de ${champ} ne se relit pas, arrêt.`)
    }
  }
  return patch
}

export async function reprendrePII(
  admin: SupabaseClient,
  { mode, ecrire = false, limite = 100 }: { mode: ModeReprise; ecrire?: boolean; limite?: number }
): Promise<BilanReprise> {
  const lignes: Ligne[] = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await admin.from("personnes").select(COLONNES).order("id").range(de, de + 999)
    if (error) throw new Error(error.message)
    lignes.push(...((data ?? []) as Ligne[]))
    if (!data || data.length < 1000) break
  }

  const bilan: BilanReprise = {
    mode, ecrit: ecrire, profils: lignes.length, aTraiter: 0, traites: 0, restants: 0,
    valeursAChiffrer: 0, dateOfBirthRepris: 0, clairVidable: 0, clairDivergent: 0, indechiffrables: 0,
  }

  // Lecture de tout le monde d'abord : c'est aussi le garde-fou de la clé.
  const lus = lignes.map((p) => {
    const lu = lirePII(p)
    for (const champ of CHAMPS_PII) {
      if (p[`${champ}_encrypted`] && lu[champ] == null) bilan.indechiffrables++
    }
    return lu
  })
  if (ecrire && bilan.indechiffrables > 0) {
    throw new Error(
      `${bilan.indechiffrables} valeur(s) déjà chiffrée(s) ne se relisent pas avec la clé en place : ` +
        "ce n'est pas la clé de production, rien n'a été écrit."
    )
  }

  for (let i = 0; i < lignes.length; i++) {
    // Au-delà de la limite, on se contente de compter (pas de chiffrement).
    const patch = patchPour(lignes[i], lus[i], mode, ecrire && bilan.traites < limite, bilan)
    if (!patch) continue
    bilan.aTraiter++
    if (!ecrire || bilan.traites >= limite) continue
    const { error } = await admin.from("personnes").update(patch).eq("id", lignes[i].id)
    if (error) throw new Error(`${lignes[i].id} : ${error.message}`)
    bilan.traites++
  }
  bilan.restants = bilan.aTraiter - bilan.traites
  return bilan
}
