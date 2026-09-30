// Fourchette du JEH — bornes du prix et de la rétribution d'un JEH, éditées
// dans Administration ▸ Paramètres car elles changent.
//
// Fixé par la CNJE, révisé en AGP :
//   - prix d'un JEH facturé au client entre 80 € et 500 € HT (fourchette
//     80–450 € HT depuis 2021, plafond relevé à 500 € à l'AGP du 14/03/2026) ;
//   - 320 € brut au plus par JEH reversé à l'intervenant (indexé sur le
//     plafond journalier de la Sécurité sociale, LFSS 2026). Au-delà, les
//     cotisations se calculent sur 70 % de la rétribution brute au lieu de
//     l'assiette forfaitaire.
// Fixé par la Junior (la CNJE n'en impose pas) : une rétribution minimum par
// JEH, par défaut l'assiette forfaitaire URSSAF d'un JEH, 4 × SMIC horaire au
// 1er janvier (48,08 € en 2026).
// Sous l'un des deux minimums, la mission n'est pas enregistrée ; au-dessus
// d'un plafond, Befast alerte et propose plus de JEH.
//
// Le JEH est indivisible : une mission compte un nombre ENTIER de JEH par
// intervenant, et au moins assez pour tenir sous les deux plafonds.

import { formatEuros } from "./remuneration"

// Clé historique de Trésorerie ▸ Pilotage des prix (déjà à 80 en prod).
export const PARAMETRE_PRIX_MIN_JEH_CLIENT = "prix_jeh_min"
export const PARAMETRE_PLAFOND_JEH_CLIENT = "jeh_plafond_client_ht"
export const PARAMETRE_PLAFOND_JEH_INTERVENANT = "jeh_plafond_intervenant_brut"
export const PARAMETRE_RETRIBUTION_MIN_JEH = "jeh_retribution_min_brut"

export type FourchetteJeh = {
  prixMinClientHt: number
  plafondClientHt: number
  plafondIntervenantBrut: number
  retributionMinBrut: number
}

export const FOURCHETTE_JEH_DEFAUT: FourchetteJeh = {
  prixMinClientHt: 80,
  plafondClientHt: 500,
  plafondIntervenantBrut: 320,
  retributionMinBrut: 48.08,
}

const nombre = (valeur: unknown) => (valeur === "" || valeur == null ? NaN : Number(valeur))
const positif = (valeur: unknown, defaut: number) => {
  const n = nombre(valeur)
  return Number.isFinite(n) && n > 0 ? n : defaut
}
// Les minimums acceptent 0 (aucun blocage) ; vide ou invalide ⇒ défaut.
const positifOuNul = (valeur: unknown, defaut: number) => {
  const n = nombre(valeur)
  return Number.isFinite(n) && n >= 0 ? n : defaut
}

/** Paramètres de la structure → fourchette ; valeurs par défaut si absentes ou invalides. */
export function lireFourchetteJeh(parametres: Record<string, string | null | undefined> | null | undefined): FourchetteJeh {
  return {
    prixMinClientHt: positifOuNul(parametres?.[PARAMETRE_PRIX_MIN_JEH_CLIENT], FOURCHETTE_JEH_DEFAUT.prixMinClientHt),
    plafondClientHt: positif(parametres?.[PARAMETRE_PLAFOND_JEH_CLIENT], FOURCHETTE_JEH_DEFAUT.plafondClientHt),
    plafondIntervenantBrut: positif(
      parametres?.[PARAMETRE_PLAFOND_JEH_INTERVENANT],
      FOURCHETTE_JEH_DEFAUT.plafondIntervenantBrut
    ),
    retributionMinBrut: positifOuNul(
      parametres?.[PARAMETRE_RETRIBUTION_MIN_JEH],
      FOURCHETTE_JEH_DEFAUT.retributionMinBrut
    ),
  }
}

const r2 = (n: number) => Math.round(n * 100) / 100
// ceil tolérant au bruit flottant : 960 / 320 doit rester 3, pas 4.
const plafondEntier = (x: number) => Math.ceil(x - 1e-9)

/**
 * Plus petit nombre entier de JEH (au moins 1) qui tient sous les deux
 * plafonds, pour UN intervenant : sa rétribution brute et ce que sa part de
 * mission coûte au client (HT, marge comprise, frais exclus).
 */
export function nbJehMinimum(retribution: number, coutClientHt: number, f: FourchetteJeh = FOURCHETTE_JEH_DEFAUT): number {
  return Math.max(
    1,
    plafondEntier((Number(coutClientHt) || 0) / f.plafondClientHt),
    plafondEntier((Number(retribution) || 0) / f.plafondIntervenantBrut)
  )
}

export type DepassementFourchette = { cote: "client" | "intervenant"; parJeh: number; plafond: number }

/** Plafonds CNJE dépassés par une mission de `nbJeh` JEH par intervenant (vide si conforme ou non chiffrée). */
export function depassementsFourchetteJeh(
  nbJeh: number,
  retribution: number,
  coutClientHt: number,
  f: FourchetteJeh = FOURCHETTE_JEH_DEFAUT
): DepassementFourchette[] {
  if (!(nbJeh > 0)) return []
  const depassements: DepassementFourchette[] = []
  const clientParJeh = r2((Number(coutClientHt) || 0) / nbJeh)
  if (clientParJeh > f.plafondClientHt) depassements.push({ cote: "client", parJeh: clientParJeh, plafond: f.plafondClientHt })
  const intervenantParJeh = r2((Number(retribution) || 0) / nbJeh)
  if (intervenantParJeh > f.plafondIntervenantBrut) {
    depassements.push({ cote: "intervenant", parJeh: intervenantParJeh, plafond: f.plafondIntervenantBrut })
  }
  return depassements
}

/**
 * Raison de refuser l'enregistrement d'une mission, ou null. Une mission non
 * rétribuée (0 €) passe ; une mission rétribuée compte au moins 1 JEH, est
 * facturée au moins le prix minimum CNJE par JEH et verse au moins la
 * rétribution minimum de la Junior par JEH.
 */
export function blocageRetribution(
  nbJeh: number,
  retribution: number,
  coutClientHt: number,
  f: FourchetteJeh = FOURCHETTE_JEH_DEFAUT
): string | null {
  const montant = Number(retribution) || 0
  if (montant <= 0) return null
  if (!(nbJeh >= 1)) return "Une mission rétribuée compte au moins 1 JEH par intervenant."
  const clientParJeh = r2((Number(coutClientHt) || 0) / nbJeh)
  if (clientParJeh < f.prixMinClientHt) {
    return `${formatEuros(clientParJeh)} HT facturé par JEH, c'est sous le minimum CNJE de ${formatEuros(f.prixMinClientHt)} HT : augmentez la rétribution ou la marge, ou réduisez le nombre de JEH.`
  }
  const parJeh = r2(montant / nbJeh)
  if (parJeh < f.retributionMinBrut) {
    return `${formatEuros(parJeh)} brut reversé par JEH, c'est sous le minimum de ${formatEuros(f.retributionMinBrut)} fixé par la Junior (Paramètres ▸ Fourchette du JEH).`
  }
  return null
}
