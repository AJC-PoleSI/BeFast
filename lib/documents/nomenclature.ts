/**
 * Nomenclature des documents AJC (spec SDP) — codes par catégorie de modèle.
 *
 * Module sans dépendance serveur : il sert à la fois à la génération
 * (app/api/documents/*) et à l'aide « i » affichée dans l'interface.
 * Le format du nom (AA CODE_TYPE NUMERO_ETUDE) est décrit dans
 * lib/document-numbering.ts.
 */

export type CodeCategorie = {
  /** CODE_TYPE du nom de fichier ("RDM", "AV"…). */
  code: string
  /** Suffixe de compteur sur 2 chiffres ("RDM01", "RDM02"…). */
  numbered: boolean
  /** Le nom rappelle le RDM parent ("26 AV01 RDM01 18"), compteur propre à chaque RDM. */
  parentRdm?: boolean
  /** Le nom rappelle la convention d'étude ("26 AV01 CE03") : avenant à la CE. */
  parentCe?: boolean
}

export const CATEGORY_CODES: Record<string, CodeCategorie> = {
  accord_confidentialite: { code: "AC", numbered: false },
  avant_projet: { code: "AP", numbered: false },
  bon_commande: { code: "BC", numbered: false },
  convention_cadre: { code: "CC", numbered: false },
  convention_client: { code: "CCL", numbered: false },
  convention_etude: { code: "CE", numbered: false },
  fiche_selection: { code: "FS", numbered: false },
  // Les PV sont numérotés par étude ("26 PVRI01 07") — cf. nomenclature SDP
  pv_recette_final: { code: "PVF", numbered: true },
  pv_recette_intermediaire: { code: "PVI", numbered: true },
  avenant_mission: { code: "AV", numbered: true, parentCe: true },
  rdm: { code: "RDM", numbered: true },
  avenant_rdm: { code: "AV", numbered: true, parentRdm: true },
  avenant_rupture_rdm: { code: "AR", numbered: true, parentRdm: true },
  bulletin_versement: { code: "BV", numbered: true },
  questionnaire_satisfaction: { code: "QS", numbered: false },
  rapport_pedagogique: { code: "RP", numbered: false },
  // Les factures ont déjà leur propre numérotation (Trésorerie) — pas de compteur auto.
  facture: { code: "FA", numbered: false },
}

/**
 * Avenants au RDM et avenants de rupture partagent UN compteur par RDM
 * ("26 AV01 RDM09 03" puis "26 AR02 RDM09 03").
 */
export const CATEGORIES_AVENANT_RDM = ["avenant_rdm", "avenant_rupture_rdm"]

/** Catégories dont le document est propre à UN intervenant (une génération par personne). */
export const CATEGORIES_PAR_INTERVENANT = new Set([
  "rdm",
  "avenant_rdm",
  "avenant_rupture_rdm",
  "bulletin_versement",
  "questionnaire_satisfaction",
  "rapport_pedagogique",
])

export function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

/** Code lisible d'une catégorie ("avenant_rdm" → "AV01 RDMxx"), pour l'aide de l'interface. */
export function codeCategorie(category: string | null | undefined): CodeCategorie | null {
  return (category && CATEGORY_CODES[category]) || null
}

/** Légende affichée dans l'aide « i » : un exemple par type de document usuel. */
export const NOMENCLATURE_EXEMPLES: { code: string; exemple: string; libelle: string }[] = [
  { code: "CE", exemple: "26 CE 18", libelle: "Convention d'étude" },
  { code: "RDM", exemple: "26 RDM01 18", libelle: "Récapitulatif de mission — un par intervenant, numéroté sur l'étude" },
  { code: "AV", exemple: "26 AV01 RDM01 18", libelle: "Avenant au RDM — compteur propre à chaque RDM" },
  { code: "AR", exemple: "26 AR02 RDM01 18", libelle: "Avenant de rupture du RDM — même compteur que les avenants du RDM" },
  { code: "AV…CE", exemple: "26 AV01 CE18", libelle: "Avenant à la convention d'étude" },
  { code: "BV", exemple: "26 BV01 18", libelle: "Bulletin de versement" },
  { code: "PVI / PVF", exemple: "26 PVI01 18", libelle: "PV de recette intermédiaire / final" },
]
