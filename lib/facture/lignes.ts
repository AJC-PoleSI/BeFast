/**
 * Lignes du tableau d'une facture (« Désignation / Nombre de JEH / Montant
 * unitaire / Montant HT »), une par bloc de l'échéancier, marge refondue dans
 * les prix : le client ne voit jamais la marge.
 *
 * Origine du montant d'une ligne :
 * - étude issue d'une proposition : le bloc porte déjà son prix unitaire marge
 *   comprise (`prix_jeh`, écrit par lib/actions/propositions.ts) ;
 * - étude saisie à la main : le bloc n'a pas de prix, on reprend le coût client
 *   de la mission liée (cf. coutClientMission).
 *
 * Le tableau doit se totaliser exactement au Total prestation de l'étude
 * (`etudes.budget_ht`, saisi à la main) : si les lignes n'y tombent pas pile,
 * elles sont recalées au prorata, et la dernière absorbe l'arrondi. Le Montant
 * HT d'une ligne fait foi et le prix unitaire en est déduit (910 € pour 3 JEH
 * ⇒ 303,33 €), comme dans le tableur AJC.
 */
import { coutClientMission, type BaremeMission } from "../missions/remuneration"

type Nombre = number | string | null | undefined

export type BlocFacture = {
  mission_id?: string | null
  nombre_jeh?: Nombre
  jeh?: Nombre
  prix_jeh?: Nombre
}

export type LigneFacture = {
  nombre_jeh: number
  prix_jeh: number
  montant_ht: number
}

const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

/** Répartit `total` au prorata de `poids`, la dernière ligne pondérée absorbant l'arrondi. */
function repartir(total: number, poids: number[]): number[] {
  const sommePoids = poids.reduce((s, p) => s + p, 0)
  const dernier = poids.reduce((idx, p, i) => (p > 0 ? i : idx), -1)
  let cumul = 0
  return poids.map((p, i) => {
    if (p <= 0) return 0
    const montant = i === dernier ? r2(total - cumul) : r2((total * p) / sommePoids)
    cumul = r2(cumul + montant)
    return montant
  })
}

/**
 * `blocs` doivent être dans l'ordre d'affichage. `totalPrestation` = montant
 * que les lignes doivent totaliser, ou null pour ne pas recaler (facture
 * limitée à une seule phase).
 */
export function lignesFacture(
  blocs: BlocFacture[],
  missions: (BaremeMission & { id: string })[],
  opts: { margePct: Nombre; totalPrestation: number | null }
): LigneFacture[] {
  const missionsParId = new Map(missions.map((m) => [m.id, m]))

  const jehs = blocs.map((b) => Number(b.nombre_jeh) || Number(b.jeh) || 0)
  let montants = blocs.map((b, i) => {
    const prix = Number(b.prix_jeh) || 0
    if (prix > 0) return r2(prix * jehs[i])
    const mission = b.mission_id ? missionsParId.get(b.mission_id) : undefined
    return mission ? coutClientMission(mission, opts.margePct) : 0
  })

  const cible = opts.totalPrestation
  if (cible != null && cible > 0) {
    const somme = r2(montants.reduce((s, m) => s + m, 0))
    if (Math.abs(somme - cible) >= 0.005) {
      // Sans aucun montant exploitable, on répartit au prorata des JEH.
      montants = repartir(cible, somme > 0 ? montants : jehs)
    }
  }

  return blocs.map((_, i) => ({
    nombre_jeh: jehs[i],
    prix_jeh: jehs[i] > 0 ? r2(montants[i] / jehs[i]) : 0,
    montant_ht: montants[i],
  }))
}
