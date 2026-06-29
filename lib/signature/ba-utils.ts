/**
 * Helpers purs (sans dépendance serveur) pour les bulletins d'adhésion.
 * Séparés de ba.ts (qui est `server-only`) pour rester testables sous Vitest.
 */

import type { BaFieldValues } from "@/lib/signature/ba-pdf"

/** Champs profil requis pour déclencher l'envoi du BA. */
export const BA_REQUIRED_PROFILE_FIELDS = [
  "prenom",
  "nom",
  "portable",
  "date_naissance",
  "adresse",
  "ville",
  "code_postal",
  "etablissement",
  "scolarite",
] as const

/** Types de justificatifs requis (les autres ne sont pas bloquants). */
export const BA_REQUIRED_DOC_TYPES = ["carte_identite", "carte_etudiante"] as const

export interface MemberData {
  id: string
  email: string
  prenom: string | null
  nom: string | null
  portable: string | null
  promo: string | null
  etablissement: string | null
  scolarite: string | null
  ba_auto: boolean
  account_status: string
  // champs déchiffrés
  adresse: string | null
  ville: string | null
  code_postal: string | null
  date_naissance: string | null
}

/** Liste des champs profil requis manquants pour ce membre. */
export function missingProfileFields(m: MemberData): string[] {
  return BA_REQUIRED_PROFILE_FIELDS.filter((f) => {
    const v = (m as any)[f]
    return v == null || String(v).trim() === ""
  })
}

/** Normalise un numéro FR vers le format E.164 (+33…) attendu par LiveConsent. */
export function toE164FR(phone: string | null): string {
  const raw = (phone ?? "").replace(/[^\d+]/g, "")
  if (!raw) return ""
  if (raw.startsWith("+")) return raw
  if (raw.startsWith("0")) return "+33" + raw.slice(1)
  if (raw.startsWith("33")) return "+" + raw
  return raw
}

/** Formate une date ISO (YYYY-MM-DD…) en JJ/MM/AAAA ; renvoie tel quel sinon. */
export function frDate(value: string | null): string {
  if (!value) return ""
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  return value
}

/** Construit les valeurs de champs du template BA à partir d'un membre. */
export function buildBaFieldValues(m: MemberData): BaFieldValues {
  const prenom = m.prenom ?? ""
  const nom = m.nom ?? ""
  return {
    prenom,
    nom,
    nom_complet: `${prenom} ${nom}`.trim(),
    email: m.email ?? "",
    portable: m.portable ?? "",
    promo: m.promo ?? "",
    etablissement: m.etablissement ?? "",
    scolarite: m.scolarite ?? "",
    adresse: m.adresse ?? "",
    ville: m.ville ?? "",
    code_postal: m.code_postal ?? "",
    date_naissance: frDate(m.date_naissance),
    date_jour: frDate(new Date().toISOString()),
  }
}
