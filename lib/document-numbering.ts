/**
 * Nomenclature des documents AJC (spec SDP) :
 *
 *   AA CODE_TYPE NUMERO_ETUDE [infos complémentaires]   →   "26 RDM01 18"
 *
 * - AA           : deux derniers chiffres de l'année ("26" = 2026)
 * - NUMERO_ETUDE : numéro de l'étude dans l'année, TOUJOURS sur 2 chiffres ("18")
 * - code classeur: AA + NUMERO_ETUDE, sur 4 chiffres ("2618")
 *
 * Le champ `etudes.numero` est saisi à la main et contient le **code classeur**
 * ("2618"), pas le numéro d'étude. Les templates doivent donc toujours passer
 * par ces helpers : {etude.numero} expose les 2 chiffres, {etude.code_classeur}
 * les 4.
 */

/** Chiffres d'un numéro saisi librement ("2026-00" → "202600"). */
function digitsOf(numero?: string | null): string {
  return String(numero ?? "").replace(/\D/g, "")
}

/**
 * Numéro d'étude sur 2 chiffres — le NUMERO_ETUDE de la nomenclature.
 * "2618" → "18" · "18" → "18" · "2026-00" → "00" · "7" → "07"
 */
export function numeroEtudeCourt(numero?: string | null): string {
  const d = digitsOf(numero)
  if (!d) return ""
  return d.slice(-2).padStart(2, "0")
}

/**
 * Segment identifiant le RDM parent d'un avenant, extrait de la référence du
 * RDM ("26 RDM01 18" ou "26 RDM01 18.docx" → "RDM01").
 * Chaîne vide si la référence ne contient aucun RDM.
 */
export function segmentRdmParent(referenceRdm?: string | null): string {
  const m = /RDM\d+/i.exec(String(referenceRdm ?? ""))
  return m ? m[0].toUpperCase() : ""
}

/**
 * Code classeur sur 4 chiffres (AA + NUMERO_ETUDE) : "2618".
 * Si le numéro stocké ne porte pas l'année (ex. "18"), on complète avec `annee`.
 */
export function codeClasseurEtude(
  numero?: string | null,
  annee: number = new Date().getFullYear()
): string {
  const d = digitsOf(numero)
  if (!d) return ""
  const prefixe = d.slice(0, -2)
  const aa = prefixe ? prefixe.slice(-2).padStart(2, "0") : String(annee).slice(-2)
  return `${aa}${numeroEtudeCourt(d)}`
}
