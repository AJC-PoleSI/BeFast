/**
 * Affectation directe d'un intervenant à une mission, sans candidature
 * préalable. Elle se matérialise par une candidature créée d'office au statut
 * « acceptee » : c'est ce statut que lisent déjà le compteur d'acceptés, les
 * documents (RDM…), la trésorerie et l'espace de l'intervenant.
 */

/** Une mission sans nombre d'intervenants renseigné en compte un. */
export function missionComplete(accepteesCount: number, nbIntervenants: number | null): boolean {
  return accepteesCount >= (nbIntervenants ?? 1)
}

/**
 * Statuts de compte affectables. Un compte en attente de validation l'est
 * aussi : l'affectation passe, avec un avertissement (cf.
 * `avertissementsAffectation`). Un compte rejeté ou supprimé ne l'est pas.
 */
export const STATUTS_AFFECTABLES: readonly string[] = ["validated", "pending_validation"]

/** Motif de refus d'une affectation directe, ou `null` si elle est possible. */
export function motifRefusAffectation(opts: {
  personne: { account_status: string | null } | null
  dejaSurMission: boolean
  accepteesCount: number
  nbIntervenants: number | null
}): string | null {
  if (!opts.personne) return "Personne introuvable."
  if (opts.personne.account_status === "rejected") {
    return "Ce compte a été rejeté : repassez-le en attente (Administration → Membres) avant de l'affecter."
  }
  if (!STATUTS_AFFECTABLES.includes(opts.personne.account_status ?? "")) {
    return "Ce compte n'est plus actif : impossible de l'affecter à une mission."
  }
  if (opts.dejaSurMission) {
    return "Cette personne est déjà positionnée sur la mission : utilisez « Accepter » sur sa candidature."
  }
  if (missionComplete(opts.accepteesCount, opts.nbIntervenants)) {
    return `La mission est complète (${opts.accepteesCount} / ${opts.nbIntervenants ?? 1} intervenants acceptés).`
  }
  return null
}

const LIBELLES_MANQUANTS: Record<string, string> = {
  prenom: "prénom",
  nom: "nom",
  portable: "téléphone",
  date_naissance: "date de naissance",
  adresse: "adresse",
  ville: "ville",
  code_postal: "code postal",
  etablissement: "établissement",
  scolarite: "scolarité",
  carte_identite_recto: "carte d'identité",
  carte_etudiante: "carte étudiante",
}

/**
 * Avertissements non bloquants à montrer quand on affecte quelqu'un : compte
 * pas encore validé, dossier incomplet. `manquants` = champs de profil et
 * justificatifs exigés pour le BA (BA_REQUIRED_PROFILE_FIELDS /
 * BA_REQUIRED_DOC_TYPES) absents du dossier.
 */
export function avertissementsAffectation(opts: {
  account_status: string | null
  manquants: string[]
}): string[] {
  const avertissements: string[] = []
  if (opts.account_status !== "validated") avertissements.push("Compte en attente de validation")
  if (opts.manquants.length > 0) {
    const libelles = opts.manquants.map((m) => LIBELLES_MANQUANTS[m] ?? m)
    avertissements.push(`Dossier incomplet : ${libelles.join(", ")}`)
  }
  return avertissements
}

/**
 * `true` pour une candidature créée par un tiers (affectation directe). Une
 * candidature déposée par l'intervenant lui-même n'a pas de `created_by`.
 */
export function estAffectationDirecte(c: { personne_id: string; created_by?: string | null }): boolean {
  return !!c.created_by && c.created_by !== c.personne_id
}
