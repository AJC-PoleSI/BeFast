// Publication mission par mission : l'œil de l'étude ouvre l'étude, celui de
// chaque mission ouvre la mission. Une mission n'est proposée aux intervenants
// (liste /missions, fiche mission, candidature) que si les DEUX sont publiées —
// on peut ainsi ouvrir une mission d'une étude et garder l'autre pour plus tard.
// Même règle côté base : RLS "missions read" et "candidatures insert own"
// (migration 074).
export function estMissionPubliee(mission: {
  published?: boolean | null
  etudes?: { published?: boolean | null } | null
}): boolean {
  return mission.published === true && mission.etudes?.published === true
}
