/**
 * Sépare « mes études » (créateur, suiveur ou intervenant sur une mission)
 * des autres, en conservant l'ordre de la liste reçue (déjà triée et filtrée
 * par la page). Demande de Baptiste du 02/10/2026 : retrouver ses propres
 * études en haut plutôt que de les chercher dans la liste de toute la JE.
 */
export function partitionMesEtudes<T extends { id: string }>(
  etudes: T[],
  mesEtudeIds: Iterable<string>
): { mine: T[]; others: T[] } {
  const mesIds = new Set(mesEtudeIds)
  const mine: T[] = []
  const others: T[] = []
  for (const etude of etudes) (mesIds.has(etude.id) ? mine : others).push(etude)
  return { mine, others }
}

// Ordre de l'accueil : ce qui demande de l'attention d'abord (en cours,
// signée), les études closes à la fin. Un statut inconnu passe avant les
// études closes plutôt que d'être caché.
const PRIORITE_ACCUEIL: Record<string, number> = {
  en_cours: 0,
  signee: 1,
  en_cours_prospection: 2,
  prospection: 3,
  prospect: 3,
  terminee: 5,
  annulee: 6,
}

/** Trie (sans muter) en gardant l'ordre reçu à priorité égale. */
export function ordonnerPourAccueil<T extends { statut: string }>(etudes: T[]): T[] {
  const rang = (e: T) => PRIORITE_ACCUEIL[e.statut] ?? 4
  return etudes
    .map((e, i) => ({ e, i }))
    .sort((a, b) => rang(a.e) - rang(b.e) || a.i - b.i)
    .map(({ e }) => e)
}
