/**
 * Tableau de bord du rôle intervenant — logique pure (aucun accès base).
 *
 * Toutes les cartes « Mes … » ne portent que sur l'intervenant connecté :
 * l'appelant charge SES candidatures (`.eq("personne_id", user.id)`) et SES
 * lignes de `retributions`.
 *
 * Vocabulaire :
 * - candidature déposée = ligne `candidatures` créée par l'intervenant
 *   lui-même. Une affectation directe (créée par un membre, cf.
 *   lib/missions/affectation.ts) n'est pas une candidature : elle compte dans
 *   les missions retenues, pas dans « Mes candidatures » ;
 * - mission retenue = candidature au statut `acceptee`, affectations directes
 *   comprises (c'est la règle métier « l'intervenant est sur la mission ») ;
 * - en cours = ni terminée, ni payée, ni annulée (une mission encore
 *   « ouverte » à d'autres intervenants est en cours pour celui déjà retenu).
 */

import { estAffectationDirecte } from "../missions/affectation"
import { remunerationParIntervenant, type BaremeMission } from "../missions/remuneration"

export type EtudeTableauDeBord = { id: string; statut: string | null }

export type MissionTableauDeBord = BaremeMission & {
  id: string
  nom: string | null
  statut: string | null
  etude_id: string | null
  /** null quand la RLS masque l'étude. */
  etudes?: EtudeTableauDeBord | null
}

export type CandidatureTableauDeBord = {
  id: string
  personne_id: string
  mission_id: string
  created_by?: string | null
  statut: string
  created_at: string
  /** null quand la RLS masque la mission : l'UI affiche alors un libellé de secours. */
  missions: MissionTableauDeBord | null
}

/** Ligne de la table `retributions` de l'intervenant connecté. */
export type RetributionTableauDeBord = {
  mission_id: string
  montant: number | string | null
  date_paiement: string | null
}

const MISSION_STATUTS_CLOS = ["terminee", "payee", "annulee"]
const ETUDE_STATUTS_CLOS = ["terminee", "annulee"]

export const LIBELLE_MISSION_INDISPONIBLE = "Mission indisponible"

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Candidatures déposées par l'intervenant, une par mission (la plus récente),
 * de la plus récente à la plus ancienne. La contrainte unique
 * (mission_id, personne_id) empêche déjà les doublons en base : le
 * dédoublonnage n'est qu'un garde-fou.
 */
export function candidaturesDeposees(candidatures: CandidatureTableauDeBord[]): CandidatureTableauDeBord[] {
  const triees = [...candidatures]
    .filter((c) => !estAffectationDirecte(c))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  const vues = new Set<string>()
  return triees.filter((c) => {
    if (vues.has(c.mission_id)) return false
    vues.add(c.mission_id)
    return true
  })
}

export type ResumeCandidatures = {
  total: number
  enAttente: number
  acceptees: number
  refusees: number
}

export function resumeCandidatures(deposees: CandidatureTableauDeBord[]): ResumeCandidatures {
  return {
    total: deposees.length,
    enAttente: deposees.filter((c) => c.statut === "en_attente").length,
    acceptees: deposees.filter((c) => c.statut === "acceptee").length,
    refusees: deposees.filter((c) => c.statut === "refusee").length,
  }
}

/** « 1 en attente · 2 acceptées », ou « Aucune candidature ». */
export function sousTitreCandidatures(resume: ResumeCandidatures): string {
  if (resume.total === 0) return "Aucune candidature"
  const acceptees = `${resume.acceptees} acceptée${resume.acceptees > 1 ? "s" : ""}`
  return `${resume.enAttente} en attente · ${acceptees}`
}

/**
 * Missions sur lesquelles l'intervenant est retenu (affectations directes
 * comprises), une fois chacune. Une mission illisible (RLS) est ignorée : sans
 * son barème ni son statut, on ne peut ni la compter ni la chiffrer.
 */
export function missionsRetenues(candidatures: CandidatureTableauDeBord[]): MissionTableauDeBord[] {
  const parId = new Map<string, MissionTableauDeBord>()
  for (const c of candidatures) {
    if (c.statut !== "acceptee" || !c.missions) continue
    parId.set(c.missions.id, c.missions)
  }
  return Array.from(parId.values())
}

export function missionsEnCours(missions: MissionTableauDeBord[]): MissionTableauDeBord[] {
  return missions.filter((m) => !MISSION_STATUTS_CLOS.includes(m.statut ?? ""))
}

/**
 * Études distinctes des missions en cours, hors études terminées ou annulées.
 * Une étude illisible compte par son identifiant : la mission, elle, dit
 * qu'elle en fait partie.
 */
export function nbEtudesEnCours(missionsEnCours: MissionTableauDeBord[]): number {
  const ids = new Set<string>()
  for (const m of missionsEnCours) {
    if (!m.etude_id) continue
    if (m.etudes && ETUDE_STATUTS_CLOS.includes(m.etudes.statut ?? "")) continue
    ids.add(m.etude_id)
  }
  return ids.size
}

/**
 * Rétributions brutes prévues sur les missions retenues, et la part déjà
 * versée. Même règle que la trésorerie (lib/tresorerie/retributions.ts) : une
 * ligne `retributions` fait foi pour le montant et le versement (date de
 * paiement renseignée) ; sans ligne, on prend la rétribution PAR intervenant
 * de la mission (lib/missions/remuneration.ts). Une mission annulée ne compte
 * que si un versement a été enregistré.
 */
export function retributionsIntervenant(
  retenues: MissionTableauDeBord[],
  records: RetributionTableauDeBord[]
): { prevu: number; verse: number } {
  const recordParMission = new Map(records.map((r) => [r.mission_id, r]))
  let prevu = 0
  let verse = 0
  for (const m of retenues) {
    const record = recordParMission.get(m.id)
    if (m.statut === "annulee" && !record) continue
    const montant = record ? round2(Number(record.montant) || 0) : remunerationParIntervenant(m)
    prevu = round2(prevu + montant)
    if (record?.date_paiement) verse = round2(verse + montant)
  }
  return { prevu, verse }
}

export function libelleStatutCandidature(statut: string): string {
  if (statut === "acceptee") return "Acceptée"
  if (statut === "refusee") return "Refusée"
  return "En attente"
}

export function libelleMission(c: CandidatureTableauDeBord): string {
  return c.missions?.nom?.trim() || LIBELLE_MISSION_INDISPONIBLE
}
