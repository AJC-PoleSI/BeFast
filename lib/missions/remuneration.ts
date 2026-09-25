// Barème d'une mission. `nb_jeh` est le nombre de JEH de CHAQUE intervenant et
// `remuneration` le montant versé à chaque intervenant pour l'ensemble de ses
// JEH — ce n'est pas un tarif par JEH. Ex. (étude 2620) : 26 intervenants à
// 2 JEH pour 311 € ⇒ 52 JEH au total, 155,50 € par JEH, 8 086 € de rétributions.
// Repli : les missions créées depuis une proposition n'ont pas de
// `remuneration` mais un `taux_jour`, qui lui est un tarif PAR JEH.
// Même règle côté trésorerie : `montantParIntervenant`
// (lib/tresorerie/retributions.ts).

type Nombre = number | string | null | undefined

export type BaremeMission = {
  nb_jeh?: Nombre
  nb_intervenants?: Nombre
  remuneration?: Nombre
  taux_jour?: Nombre
}

const round2 = (n: number) => Math.round(n * 100) / 100

const nbIntervenants = (m: BaremeMission) => Number(m.nb_intervenants ?? 1) || 0

/** JEH de toute la mission : JEH par intervenant × intervenants. */
export function jehTotalMission(m: BaremeMission): number {
  return (Number(m.nb_jeh) || 0) * nbIntervenants(m)
}

/** Valeur d'un JEH pour l'intervenant, ou null si rien n'est saisi. */
export function remunerationParJeh(m: BaremeMission): number | null {
  const remuneration = Number(m.remuneration) || 0
  if (remuneration > 0) {
    const nbJeh = Number(m.nb_jeh) || 0
    return nbJeh > 0 ? round2(remuneration / nbJeh) : null
  }
  const tauxJour = Number(m.taux_jour) || 0
  return tauxJour > 0 ? tauxJour : null
}

/** Rétributions de toute la mission (tous intervenants confondus). */
export function montantTotalMission(m: BaremeMission): number {
  const remuneration = Number(m.remuneration) || 0
  if (remuneration > 0) return round2(remuneration * nbIntervenants(m))
  return round2(jehTotalMission(m) * (Number(m.taux_jour) || 0))
}
