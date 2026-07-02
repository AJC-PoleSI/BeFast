// Mapping pur Be Quick (CSV) -> membre normalisé Be Fast. Aucune I/O, testable.

export interface RawRow {
  id: string
  image_url: string
  civilite: string
  etat_id: string
  etat_nom: string
  email: string
  prenom: string
  nom: string
  adresse: string
  ville: string
  code_postal: string
  num_secu: string
  portable: string
  promo: string
  poste_id: string
  poste_intitule: string
  admin_validated: string
  competences: string
  business_units: string
}

export interface MappedMember {
  legacyId: number | null
  email: string
  prenom: string
  nom: string
  civilite: string | null
  portable: string | null
  promo: string | null
  competences: string | null
  nss: string | null
  adresse: string | null
  ville: string | null
  codePostal: string | null
  roleSlug: string
  posteSlugs: string[]
  accountStatus: "validated" | "pending_validation"
  actif: boolean
  posteUnknown: boolean
}

export type MapResult =
  | { ok: true; member: MappedMember }
  | { ok: false; legacyId: number | null; email: string; reason: "email_malformed" }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Renvoie l'email normalisé, ou null si manifestement malformé. */
export function normalizeEmail(raw: string): string | null {
  const e = (raw ?? "").trim().toLowerCase()
  if (!EMAIL_RE.test(e)) return null
  return e
}

const POSTE_MAP: Record<string, { role: string; postes: string[] }> = {
  "administrateur": { role: "administrateur", postes: [] },
  "chef de projet": { role: "membre_ajc", postes: [] },
  "1a (mandat entrant)": { role: "membre_ajc", postes: [] },
  "pôle rh": { role: "membre_ajc", postes: ["pole_rh"] },
  "pôle trésorerie": { role: "membre_ajc", postes: ["tresorier"] },
  "intervenant (ba)": { role: "intervenant", postes: [] },
}

export function mapPoste(posteIntitule: string): { role: string; postes: string[]; unknown: boolean } {
  const key = (posteIntitule ?? "").trim().toLowerCase()
  if (key === "") return { role: "intervenant", postes: [], unknown: false }
  const hit = POSTE_MAP[key]
  if (hit) return { role: hit.role, postes: hit.postes, unknown: false }
  return { role: "intervenant", postes: [], unknown: true }
}

export function mapStatus(
  etatNom: string,
  adminValidated: string
): { accountStatus: "validated" | "pending_validation"; actif: boolean } {
  const etat = (etatNom ?? "").trim().toLowerCase()
  if (etat === "radié") return { accountStatus: "pending_validation", actif: false }
  if (etat === "candidats") return { accountStatus: "pending_validation", actif: true }
  const validated = (adminValidated ?? "").trim() === "1"
  return { accountStatus: validated ? "validated" : "pending_validation", actif: true }
}

function clean(v: string): string | null {
  const t = (v ?? "").trim()
  return t === "" ? null : t
}

export function mapRow(row: RawRow): MapResult {
  const legacyId = /^\d+$/.test((row.id ?? "").trim()) ? parseInt(row.id, 10) : null
  const email = normalizeEmail(row.email)
  if (!email) {
    return { ok: false, legacyId, email: (row.email ?? "").trim(), reason: "email_malformed" }
  }
  const poste = mapPoste(row.poste_intitule)
  const status = mapStatus(row.etat_nom, row.admin_validated)
  return {
    ok: true,
    member: {
      legacyId,
      email,
      prenom: (row.prenom ?? "").trim(),
      nom: (row.nom ?? "").trim(),
      civilite: clean(row.civilite),
      portable: clean(row.portable),
      promo: clean(row.promo),
      competences: clean(row.competences),
      nss: clean(row.num_secu),
      adresse: clean(row.adresse),
      ville: clean(row.ville),
      codePostal: clean(row.code_postal),
      roleSlug: poste.role,
      posteSlugs: poste.postes,
      accountStatus: status.accountStatus,
      actif: status.actif,
      posteUnknown: poste.unknown,
    },
  }
}

/** Dédoublonne par email (garde la 1ʳᵉ occurrence). */
export function dedupeByEmail(members: MappedMember[]): {
  unique: MappedMember[]
  duplicates: MappedMember[]
} {
  const seen = new Set<string>()
  const unique: MappedMember[] = []
  const duplicates: MappedMember[] = []
  for (const m of members) {
    if (seen.has(m.email)) duplicates.push(m)
    else {
      seen.add(m.email)
      unique.push(m)
    }
  }
  return { unique, duplicates }
}
