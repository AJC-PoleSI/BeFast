// Tableau des cotisations du Bulletin de Versement — contexte {bv.*} des
// modèles Word (le modèle n'a aucun calcul : cellules préformatées ici).
//
// Règles CNJE (Kiwi Légal, 2026) :
//   - assiette forfaitaire = nombre de JEH × base URSSAF par JEH, soit
//     4 × SMIC horaire brut au 1er janvier (48,08 € en 2026) ;
//   - si la rétribution brute par JEH dépasse le plafond (320 € en 2026),
//     l'assiette devient 70 % de la rétribution brute ;
//   - depuis mars 2023, TOUS les taux (accident du travail, CSG/CRDS…)
//     s'appliquent sur l'assiette de cotisation, plus sur la rétribution brute.
// Base, plafond, pourcentage et taux sont des paramètres de la structure
// (Administration ▸ Paramètres) : d'une année à l'autre, seuls eux changent.

import { PARAMETRE_PLAFOND_JEH_INTERVENANT, FOURCHETTE_JEH_DEFAUT } from "../missions/fourchette-jeh"

export const PARAMETRE_BV_BASE_URSSAF = "bv_base_urssaf"
export const PARAMETRE_BV_ASSIETTE_DEPASSEMENT_PCT = "bv_assiette_depassement_pct"

// Lignes du modèle CNJE : slug des clés `bv_<slug>_taux_junior|etudiant`.
const LIGNES: [slug: string, nom: string][] = [
  ["am", "Assurance Maladie"],
  ["at", "ACCIDENT DU TRAVAIL"],
  ["avp", "Assurance Vieillesse plafonnée"],
  ["avd", "Assurance Vieillesse déplafonnée"],
  ["af", "ALLOCATIONS FAMILIALES"],
  ["autre", "Autres contributions"],
  ["csg", "CSG déductible"],
  ["crdscsg", "CSG/CRDS non déductible"],
]

/**
 * Valeurs au 1er janvier 2026 (URSSAF, référentiel CNJE) : ce qu'on écrit dans
 * les paramètres et ce que la page Paramètres affiche tant qu'une clé manque.
 * Accident du travail : taux propre à chaque Junior (net-entreprises), laissé à 0.
 */
export const PARAMETRES_BV_2026: Record<string, string> = {
  [PARAMETRE_BV_BASE_URSSAF]: "48.08",
  [PARAMETRE_BV_ASSIETTE_DEPASSEMENT_PCT]: "70",
  bv_am_taux_junior: "13",
  bv_am_taux_etudiant: "0",
  bv_at_taux_junior: "0",
  bv_at_taux_etudiant: "0",
  bv_avp_taux_junior: "8.55",
  bv_avp_taux_etudiant: "6.9",
  bv_avd_taux_junior: "2.11",
  bv_avd_taux_etudiant: "0.4",
  bv_af_taux_junior: "5.25",
  bv_af_taux_etudiant: "0",
  bv_autre_taux_junior: "0",
  bv_autre_taux_etudiant: "0",
  bv_csg_taux_junior: "0",
  bv_csg_taux_etudiant: "6.8",
  bv_crdscsg_taux_junior: "0",
  bv_crdscsg_taux_etudiant: "2.9",
}

// Format décimal français : 1234.5 → "1234,50"
const fmtDec = (n: number, decimals = 2) => (Number(n) || 0).toFixed(decimals).replace(".", ",")
const r2 = (n: number) => Math.round(n * 100) / 100

type Parametres = Record<string, string | null | undefined>

/** Assiette de cotisation d'un BV et la règle qui l'a produite. */
export function assietteCotisations(parametres: Parametres, nbJeh: number, retributionBrute: number) {
  const num = (k: string, defaut = 0) => {
    const n = Number(parametres[k])
    return parametres[k] != null && parametres[k] !== "" && Number.isFinite(n) ? n : defaut
  }
  const baseParJeh = num(PARAMETRE_BV_BASE_URSSAF)
  const plafond = num(PARAMETRE_PLAFOND_JEH_INTERVENANT, FOURCHETTE_JEH_DEFAUT.plafondIntervenantBrut) || FOURCHETTE_JEH_DEFAUT.plafondIntervenantBrut
  const pctDepassement = num(PARAMETRE_BV_ASSIETTE_DEPASSEMENT_PCT, 70)
  const parJeh = nbJeh > 0 ? retributionBrute / nbJeh : 0
  const depassement = parJeh > plafond + 0.005
  return {
    depassement,
    baseParJeh,
    plafond,
    pctDepassement,
    assiette: r2(depassement ? (retributionBrute * pctDepassement) / 100 : nbJeh * baseParJeh),
  }
}

/** Contexte {bv.*} complet pour UN intervenant : `nbJeh` JEH pour `retributionBrute` €. */
export function contexteCotisationsBv(parametres: Parametres, nbJeh: number, retributionBrute: number) {
  const num = (k: string) => Number(parametres[k]) || 0
  const { depassement, baseParJeh, pctDepassement, assiette } = assietteCotisations(parametres, nbJeh, retributionBrute)

  const bv: Record<string, any> = {
    // Au-delà du plafond, la « base URSSAF » n'est plus forfaitaire.
    base_urssaf: depassement ? `${fmtDec(pctDepassement, 0)} % du brut` : fmtDec(baseParJeh),
    assiette: fmtDec(assiette),
    assiette_mode: depassement ? "reelle" : "forfaitaire",
    retribution_brute: fmtDec(retributionBrute),
    retribution_par_jeh: fmtDec(nbJeh > 0 ? retributionBrute / nbJeh : 0),
  }

  let totalJuniorUrssaf = 0, totalEtudiantUrssaf = 0, totalTauxEtudiantUrssaf = 0
  let totalJuniorCsg = 0, totalEtudiantCsg = 0

  for (const [slug, nom] of LIGNES) {
    const tauxJunior = num(`bv_${slug}_taux_junior`)
    const tauxEtudiant = num(`bv_${slug}_taux_etudiant`)
    const montantJunior = r2((assiette * tauxJunior) / 100)
    const montantEtudiant = r2((assiette * tauxEtudiant) / 100)

    bv[`${slug}_nom`] = nom
    bv[`${slug}_base`] = fmtDec(assiette)
    bv[`${slug}_junior_montant`] = tauxJunior > 0 ? fmtDec(montantJunior) : ""
    bv[`${slug}_etudiant_taux`] = tauxEtudiant > 0 ? fmtDec(tauxEtudiant) : ""
    bv[`${slug}_etudiant_pct`] = tauxEtudiant > 0 ? "%" : ""
    bv[`${slug}_etudiant_montant`] = tauxEtudiant > 0 ? fmtDec(montantEtudiant) : ""

    if (slug === "csg" || slug === "crdscsg") {
      totalJuniorCsg += montantJunior
      totalEtudiantCsg += montantEtudiant
    } else {
      totalJuniorUrssaf += montantJunior
      totalEtudiantUrssaf += montantEtudiant
      totalTauxEtudiantUrssaf += tauxEtudiant
    }
  }

  const totalEtudiant = r2(totalEtudiantUrssaf + totalEtudiantCsg)
  // CSG/CRDS non déductible réintégrée dans le net imposable.
  const nonDeductible = r2((assiette * num("bv_crdscsg_taux_etudiant")) / 100)
  // Ligne « évolution liée à la suppression des cotisations chômage et
  // maladie » : coefficients repris tels quels du modèle CNJE.
  const evolution = assiette * 0.0075 + assiette * 0.0145 - assiette * 0.017 + assiette * 0.0095

  bv.total_junior_urssaf = fmtDec(totalJuniorUrssaf)
  bv.total_etudiant_taux_urssaf = fmtDec(totalTauxEtudiantUrssaf)
  bv.total_etudiant_urssaf = fmtDec(totalEtudiantUrssaf)
  bv.total_junior = fmtDec(totalJuniorUrssaf + totalJuniorCsg)
  bv.total_etudiant = fmtDec(totalEtudiant)
  bv.total_cotisations = fmtDec(totalJuniorUrssaf + totalJuniorCsg + totalEtudiant)
  bv.net_paye = fmtDec(retributionBrute - totalEtudiant)
  bv.net_imposable = fmtDec(retributionBrute - totalEtudiant + nonDeductible)
  bv.evolution_suppression = fmtDec(evolution)

  return bv
}
