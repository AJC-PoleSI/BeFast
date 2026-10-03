/**
 * Nom de fichier proposé au téléchargement d'un document généré.
 *
 * Le nom stocké (« 26 RDM03 20.docx ») reste la référence du document : il
 * sert à la numérotation et est imprimé dans le document. Seul le fichier
 * téléchargé rappelle l'étudiant concerné (« 26 RDM03 20 - Felix Pitz.docx »),
 * pour s'y retrouver dans ses téléchargements — demande de Baptiste du
 * 02/10/2026.
 */
export function documentDownloadName(
  fileName: string,
  intervenant: { prenom?: string | null; nom?: string | null } | null | undefined
): string {
  const personne = [intervenant?.prenom, intervenant?.nom]
    .map((part) => cleanPart(part ?? ""))
    .filter(Boolean)
    .join(" ")
  if (!personne) return fileName

  const dot = fileName.lastIndexOf(".")
  const stem = dot > 0 ? fileName.slice(0, dot) : fileName
  const ext = dot > 0 ? fileName.slice(dot) : ""
  if (stem.endsWith(` - ${personne}`)) return fileName
  return `${stem} - ${personne}${ext}`
}

/** Caractères interdits dans un nom de fichier (Windows/macOS) et espaces superflus. */
function cleanPart(s: string): string {
  return s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim()
}

/**
 * En-tête Content-Disposition sûr. Un en-tête HTTP est en Latin-1 : un nom
 * accentué ou une apostrophe typographique faisait échouer la réponse. On
 * donne un repli ASCII et le nom exact en UTF-8 (RFC 5987).
 */
export function contentDisposition(type: "attachment" | "inline", fileName: string): string {
  const ascii =
    fileName
      .normalize("NFD")
      .replace(/[^\x20-\x7e]/g, "")
      .replace(/["\\]/g, "")
      .trim() || "document"
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  )
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encoded}`
}

const MIME_BY_EXT: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pdf: "application/pdf",
}

/** Type MIME d'un document généré, d'après son extension (docx par défaut). */
export function documentMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? ""
  return MIME_BY_EXT[ext] ?? MIME_BY_EXT.docx
}
