// Barème d'une mission — source unique de vérité, lue par la page étude, la
// trésorerie (rétributions, export), les documents (RDM, BV) et les stats.
//
// `nb_jeh` est le nombre de JEH de CHAQUE intervenant et `remuneration` le
// montant versé à chaque intervenant pour l'ensemble de ses JEH — ce n'est pas
// un tarif par JEH. Ex. (étude 2620) : 26 intervenants à 2 JEH pour 311 €
// ⇒ 52 JEH au total, 155,50 € par JEH, 8 086 € de rétributions.
//
// Repli : les missions créées depuis une proposition n'ont pas de
// `remuneration` mais un `taux_jour`, qui lui est un tarif PAR JEH.

type Nombre = number | string | null | undefined

export type BaremeMission = {
  nb_jeh?: Nombre
  nb_intervenants?: Nombre
  remuneration?: Nombre
  taux_jour?: Nombre
}

const round2 = (n: number) => Math.round(n * 100) / 100

const nbJeh = (m: BaremeMission) => Number(m.nb_jeh) || 0

// null/undefined vaut 1 intervenant implicite ; un 0 explicite reste 0 (même
// convention que `effectifDeclare` dans lib/tresorerie/retributions.ts).
const nbIntervenants = (m: BaremeMission) => Number(m.nb_intervenants ?? 1) || 0

/** Montant versé à UN intervenant pour l'ensemble de ses JEH. */
export function remunerationParIntervenant(m: BaremeMission): number {
  const remuneration = Number(m.remuneration) || 0
  if (remuneration > 0) return round2(remuneration)
  return round2(nbJeh(m) * (Number(m.taux_jour) || 0))
}

/** Valeur d'un JEH pour l'intervenant, ou null si rien n'est saisi. */
export function remunerationParJeh(m: BaremeMission): number | null {
  const parIntervenant = remunerationParIntervenant(m)
  return parIntervenant > 0 && nbJeh(m) > 0 ? round2(parIntervenant / nbJeh(m)) : null
}

/** JEH de toute la mission : JEH par intervenant × intervenants. */
export function jehTotalMission(m: BaremeMission): number {
  return nbJeh(m) * nbIntervenants(m)
}

/** Rétributions de toute la mission, tous intervenants confondus. */
export function montantTotalMission(m: BaremeMission): number {
  return round2(remunerationParIntervenant(m) * nbIntervenants(m))
}

/**
 * Coût facturé au client pour UN intervenant, marge comprise — règle du
 * template Excel Budget Audencia : ROUNDUP(rémunération / (1 − marge %)).
 * Ex. 600 € à 34 % de marge ⇒ 910 €. La rémunération versée ne change pas.
 */
export function coutClientParIntervenant(m: BaremeMission, margePct: Nombre): number {
  const remuneration = remunerationParIntervenant(m)
  // Même plafond que lib/budget/compute.ts : à 100 %, le prix serait infini.
  const marge = Math.min(Number(margePct) || 0, 99)
  if (marge <= 0) return remuneration
  // Calcul en centièmes puis arrondi à 1e-6 avant le ROUNDUP : 660 / 0,66 vaut
  // 1000.0000000000002 en flottant et donnerait 1 001 €.
  const brut = (remuneration * 100) / (100 - marge)
  return Math.ceil(Math.round(brut * 1e6) / 1e6)
}

/** Coût client de toute la mission, marge comprise, tous intervenants confondus. */
export function coutClientMission(m: BaremeMission, margePct: Nombre): number {
  return round2(coutClientParIntervenant(m, margePct) * nbIntervenants(m))
}

/** « 311 € », « 8 086 € », « 155,50 € » : décimales seulement s'il y a des centimes. */
export function formatEuros(n: number): string {
  const centimes = !Number.isInteger(round2(n))
  return (
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: centimes ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(n) + " €"
  )
}
