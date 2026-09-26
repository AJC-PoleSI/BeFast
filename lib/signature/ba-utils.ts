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

/**
 * Types de justificatifs requis (les autres ne sont pas bloquants).
 *
 * Le verso de la carte d'identité en est volontairement exclu : l'emplacement
 * n'existe que depuis le 21/09/2026 et les membres déjà inscrits n'ont déposé
 * que le recto. L'exiger bloquerait l'envoi automatique du Bulletin
 * d'Adhésion pour la soixantaine de membres concernés. Il reste demandé dans
 * l'interface, simplement sans bloquer le BA.
 */
export const BA_REQUIRED_DOC_TYPES = [
  "carte_identite_recto",
  "carte_etudiante",
] as const

export interface MemberData {
  id: string
  email: string
  prenom: string | null
  nom: string | null
  portable: string | null
  promo: string | null
  etablissement: string | null
  scolarite: string | null
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

/**
 * Partie locale d'une adresse @audencia.com. Le formulaire imprime déjà
 * « @audencia.com » après la case : pour une autre adresse (gmail…), la case
 * reste vide plutôt que d'annoncer une adresse Audencia qui n'existe pas.
 */
export function emailLocalPart(email: string | null): string {
  const [local, domaine] = (email ?? "").trim().split("@")
  if (!local || domaine?.toLowerCase() !== "audencia.com") return ""
  return local
}

/** Informations du profil imprimées sur le BA, avec leur libellé côté membre. */
const BA_PREFILL_FIELDS: ReadonlyArray<readonly [keyof MemberData, string]> = [
  ["prenom", "prénom"],
  ["nom", "nom"],
  ["portable", "téléphone"],
  ["promo", "promo"],
  ["adresse", "adresse"],
  ["code_postal", "code postal"],
  ["ville", "ville"],
]

/**
 * Libellés des informations absentes du profil, que le BA téléchargé ne pourra
 * donc pas pré-remplir. Vide quand le bulletin sort entièrement complété.
 */
export function missingBaPrefillFields(m: MemberData): string[] {
  return BA_PREFILL_FIELDS.filter(([k]) => {
    const v = m[k]
    return v == null || String(v).trim() === ""
  }).map(([, libelle]) => libelle)
}

/** Nom du BA téléchargé, en ASCII : « Bulletin_adhesion_Dupont_Jean.pdf ». */
export function baFileName(m: Pick<MemberData, "prenom" | "nom">): string {
  const segment = (s: string | null) =>
    (s ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/œ/g, "oe").replace(/Œ/g, "Oe").replace(/æ/g, "ae").replace(/Æ/g, "Ae").replace(/ß/g, "ss")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
  const suffixe = [segment(m.nom), segment(m.prenom)].filter(Boolean).join("_")
  return `Bulletin_adhesion${suffixe ? `_${suffixe}` : ""}.pdf`
}

/** Caractères de CP1252 hors Latin-1, encodables par la police Helvetica standard. */
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ")

/** Lettres sans décomposition Unicode, ramenées à leur équivalent latin. */
const TRANSLITTERATION: Record<string, string> = {
  Ł: "L", ł: "l", Đ: "D", đ: "d", Ħ: "H", ħ: "h", ı: "i",
}

function estWinAnsi(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0
  return (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WIN_ANSI_EXTRA.has(ch)
}

/**
 * Rend un texte encodable en WinAnsi, le jeu de la police Helvetica des champs
 * du BA. pdf-lib lève une exception sur tout autre caractère (« Şahin »,
 * « Łukasz »…) et le PDF entier échouait : on retire l'accent quand c'est
 * possible, les sauts de ligne deviennent des espaces, le reste un « ? ».
 */
export function toWinAnsi(text: string): string {
  let out = ""
  for (const ch of text) {
    if (estWinAnsi(ch)) out += ch
    else if (/\s/.test(ch)) out += " "
    else if (TRANSLITTERATION[ch]) out += TRANSLITTERATION[ch]
    else {
      const base = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      out += base && [...base].every(estWinAnsi) ? base : "?"
    }
  }
  return out
}

/** Concatène adresse + « CP Ville » en une seule ligne (foyer fiscal complet). */
export function fullAddress(m: MemberData): string {
  const cpVille = [m.code_postal, m.ville].filter((s) => s && String(s).trim() !== "").join(" ")
  return [m.adresse, cpVille].filter((s) => s && String(s).trim() !== "").join(", ")
}

/**
 * Construit les valeurs des champs du template BA-2025 à partir d'un membre.
 * Voir BA_FIELD_NAMES (ba-pdf) pour la correspondance avec le formulaire officiel.
 */
export function buildBaFieldValues(m: MemberData): BaFieldValues {
  const nomComplet = `${m.prenom ?? ""} ${m.nom ?? ""}`.trim()
  return {
    nom_complet: nomComplet,
    etudiant: nomComplet,
    etudiant_signature: nomComplet,
    portable: m.portable ?? "",
    email_audencia: emailLocalPart(m.email),
    promo: m.promo ?? "",
    adresse_complete: fullAddress(m),
  }
}
