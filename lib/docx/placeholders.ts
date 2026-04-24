import PizZip from "pizzip"

/**
 * Strip XML tags to get clean text content.
 * This is critical because Word splits placeholder text across multiple
 * XML runs (e.g., `<w:t>{etude</w:t><w:t>.nom}</w:t>`).
 */
function stripXmlTags(xml: string): string {
  return xml.replace(/<[^>]+>/g, "")
}

/**
 * Extrait tous les placeholders {xxx} d'un DOCX (buffer).
 * Gère les placeholders simples et pointés (ex: etude.nom).
 * Résout le problème de Word qui sépare les accolades dans différents runs XML.
 */
export function extractPlaceholders(buffer: ArrayBuffer | Buffer): string[] {
  const zip = new PizZip(buffer as any)
  
  try {
    const tags: string[] = []
    const re = /\{([^{}]+)\}/g
    
    // Scan common XML files for tags
    const targets = [
      "word/document.xml",
      "word/header1.xml", "word/header2.xml", "word/header3.xml",
      "word/footer1.xml", "word/footer2.xml", "word/footer3.xml",
    ]
    
    let textAll = ""
    for (const path of targets) {
      const f = zip.file(path)
      if (f) {
        // Strip XML tags FIRST to handle split placeholders across XML runs
        textAll += stripXmlTags(f.asText()) + "\n"
      }
    }
    
    let m: RegExpExecArray | null
    while ((m = re.exec(textAll)) !== null) {
      const raw = m[1].trim()
      if (!raw) continue
      // Ignore markers for loops, conditions, etc.
      if (raw.startsWith("#") || raw.startsWith("/") || raw.startsWith("^") || raw.startsWith("@") || raw.startsWith("?")) continue
      if (!tags.includes(raw)) tags.push(raw)
    }
    
    return tags
  } catch (e) {
    console.error("extractPlaceholders error:", e)
    return []
  }
}
