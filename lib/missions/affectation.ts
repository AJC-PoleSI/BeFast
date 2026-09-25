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

/** Motif de refus d'une affectation directe, ou `null` si elle est possible. */
export function motifRefusAffectation(opts: {
  personne: { account_status: string | null } | null
  dejaSurMission: boolean
  accepteesCount: number
  nbIntervenants: number | null
}): string | null {
  if (!opts.personne) return "Personne introuvable."
  if (opts.personne.account_status !== "validated") {
    return "Ce compte n'est pas encore validé : impossible de l'affecter à une mission."
  }
  if (opts.dejaSurMission) {
    return "Cette personne est déjà positionnée sur la mission : utilisez « Accepter » sur sa candidature."
  }
  if (missionComplete(opts.accepteesCount, opts.nbIntervenants)) {
    return `La mission est complète (${opts.accepteesCount} / ${opts.nbIntervenants ?? 1} intervenants acceptés).`
  }
  return null
}

/**
 * `true` pour une candidature créée par un tiers (affectation directe). Une
 * candidature déposée par l'intervenant lui-même n'a pas de `created_by`.
 */
export function estAffectationDirecte(c: { personne_id: string; created_by?: string | null }): boolean {
  return !!c.created_by && c.created_by !== c.personne_id
}
