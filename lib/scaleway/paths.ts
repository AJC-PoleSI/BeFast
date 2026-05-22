/**
 * Scaleway S3 key helpers — nomenclature centralisée
 *
 * Règles :
 *  - Pas d'accents, pas d'espaces (remplacés par _)
 *  - Lisible dans la console Scaleway
 *  - Unique grâce aux 8 premiers chars de l'UUID
 */

/** Sanitise un nom propre pour une clé S3 : "Ève Müller" → "Eve_Muller" */
function sanitize(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // retire les diacritiques
    .replace(/\s+/g, "_")              // espaces → _
    .replace(/[^a-zA-Z0-9_\-]/g, "")  // retire tout le reste
    .trim()
}

/**
 * Clé S3 pour un document personnel.
 *
 * Format : `personnes/{Prenom}_{Nom}_{8charsId}/{docType}/document.{ext}`
 *
 * Ex. : `personnes/Felix_Pitz_a1b2c3d4/carte_identite/document.pdf`
 */
export function buildPersonneDocPath(
  userId: string,
  prenom: string,
  nom: string,
  docType: string,
  ext: string
): string {
  const shortId = userId.replace(/-/g, "").slice(0, 8)
  const folder = `${sanitize(prenom)}_${sanitize(nom)}_${shortId}`
  return `personnes/${folder}/${docType}/document.${ext}`
}

/**
 * Clé S3 pour un document de mission (pour plus tard).
 *
 * Format : `missions/{numeroEtude}/{Prenom}_{Nom}/{fileName}`
 *
 * Ex. : `missions/ETU2024-001/Felix_Pitz/rdm.docx`
 */
export function buildMissionDocPath(
  numeroEtude: string,
  prenom: string,
  nom: string,
  fileName: string
): string {
  const folder = `${sanitize(prenom)}_${sanitize(nom)}`
  const safeName = fileName.replace(/[^a-zA-Z0-9_\-\.]/g, "_")
  return `missions/${numeroEtude}/${folder}/${safeName}`
}
