/**
 * Digest hebdomadaire du Pôle RH : comptes créés / validés, pièces déposées et
 * file d'attente de validation, avec le nom de chaque personne concernée.
 *
 * Ce fichier ne contient que la logique pure (regroupement, plafonds, tri) :
 * les requêtes vivent dans collect.ts, le HTML dans email.ts.
 */

export const TYPES_DOCUMENT: Record<string, string> = {
  carte_identite_recto: "Carte d'identité (recto)",
  carte_identite_verso: "Carte d'identité (verso)",
  carte_etudiante: "Carte étudiante",
  carte_vitale: "Carte vitale",
  preuve_lydia: "Preuve Lydia",
  rib: "RIB",
  bulletin_adhesion: "Bulletin d'adhésion",
}

/** Nombre max de personnes listées dans « en attente » ; le reste est résumé en un compteur. */
export const PLAFOND_ATTENTE = 30

export type DocumentLigne = {
  personne_id: string
  type: string
  status: string | null
  created_at: string
  updated_at: string
}

export type PersonneLigne = {
  id: string
  prenom: string | null
  nom: string | null
  created_at?: string
}

export type DepotPersonne = { personne: string; documents: string[]; dernierDepot: string }
export type AttentePersonne = { personne: string; nbDocuments: number; plusAncien: string; joursAttente: number }

export type Digest = {
  debut: string
  fin: string
  comptesCrees: { total: number; personnes: string[] }
  comptesValides: { total: number; personnes: string[] }
  comptesEnAttente: number
  depots: { total: number; parPersonne: DepotPersonne[] }
  attente: { totalDocuments: number; totalPersonnes: number; liste: AttentePersonne[]; masquees: number }
}

export function nomComplet(p: { prenom: string | null; nom: string | null } | undefined): string {
  const nom = [p?.prenom, p?.nom].filter(Boolean).join(" ").trim()
  return nom || "Personne sans nom"
}

export function libelleType(type: string): string {
  return TYPES_DOCUMENT[type] ?? type
}

/**
 * Un dépôt = ligne `pending` mise à jour dans la période (un remplacement
 * repasse la ligne en attente et fait avancer updated_at), ou ligne créée dans
 * la période quel que soit son statut. Une validation/un refus touche aussi
 * updated_at, d'où l'exclusion des lignes non `pending` pour ce critère.
 */
export function estDepotDeLaPeriode(d: DocumentLigne, debut: Date): boolean {
  const t = debut.getTime()
  if (new Date(d.created_at).getTime() >= t) return true
  return (d.status ?? "pending") === "pending" && new Date(d.updated_at).getTime() >= t
}

export function regrouperDepots(
  documents: DocumentLigne[],
  personnes: Map<string, { prenom: string | null; nom: string | null }>,
  debut: Date
): { total: number; parPersonne: DepotPersonne[] } {
  const depots = documents.filter((d) => estDepotDeLaPeriode(d, debut))
  const parId = new Map<string, DocumentLigne[]>()
  for (const d of depots) parId.set(d.personne_id, [...(parId.get(d.personne_id) ?? []), d])

  const parPersonne: DepotPersonne[] = [...parId.entries()].map(([id, docs]) => ({
    personne: nomComplet(personnes.get(id)),
    documents: docs.map((d) => libelleType(d.type)).sort((a, b) => a.localeCompare(b, "fr")),
    dernierDepot: docs.map((d) => d.updated_at).sort().at(-1)!,
  }))
  parPersonne.sort((a, b) => b.dernierDepot.localeCompare(a.dernierDepot))
  return { total: depots.length, parPersonne }
}

export function regrouperAttente(
  documents: DocumentLigne[],
  personnes: Map<string, { prenom: string | null; nom: string | null }>,
  maintenant: Date,
  plafond = PLAFOND_ATTENTE
): Digest["attente"] {
  const enAttente = documents.filter((d) => (d.status ?? "pending") === "pending")
  const parId = new Map<string, DocumentLigne[]>()
  for (const d of enAttente) parId.set(d.personne_id, [...(parId.get(d.personne_id) ?? []), d])

  const toutes: AttentePersonne[] = [...parId.entries()].map(([id, docs]) => {
    const plusAncien = docs.map((d) => d.updated_at).sort()[0]
    return {
      personne: nomComplet(personnes.get(id)),
      nbDocuments: docs.length,
      plusAncien,
      joursAttente: Math.max(0, Math.floor((maintenant.getTime() - new Date(plusAncien).getTime()) / 86_400_000)),
    }
  })
  // Les plus anciennes d'abord : ce sont celles qu'il faut traiter en priorité.
  toutes.sort((a, b) => a.plusAncien.localeCompare(b.plusAncien))

  return {
    totalDocuments: enAttente.length,
    totalPersonnes: toutes.length,
    liste: toutes.slice(0, plafond),
    masquees: Math.max(0, toutes.length - plafond),
  }
}

export function periodeDuDigest(maintenant = new Date()): { debut: Date; fin: Date } {
  return { debut: new Date(maintenant.getTime() - 7 * 86_400_000), fin: maintenant }
}
