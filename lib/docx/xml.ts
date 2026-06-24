/**
 * Échappement XML pour l'injection sûre de valeurs utilisateur dans les
 * documents OpenXML (PPTX / DOCX / XLSX générés par substitution de balises).
 *
 * Toute valeur provenant de l'utilisateur (nom de phase, société, objectifs…)
 * DOIT passer par `escapeXml` avant d'être insérée dans le XML d'un slide, sous
 * peine de corrompre le fichier (caractères `<`, `>`, `&`) ou de permettre une
 * injection de balises.
 */
export function escapeXml(unsafe: unknown): string {
  if (unsafe === null || unsafe === undefined) return ""
  return String(unsafe).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;"
      case ">":
        return "&gt;"
      case "&":
        return "&amp;"
      case "'":
        return "&apos;"
      case '"':
        return "&quot;"
      default:
        return c
    }
  })
}
