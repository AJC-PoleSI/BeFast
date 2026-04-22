import PizZip from "pizzip"
import Docxtemplater from "docxtemplater"

/**
 * Extrait tous les placeholders {xxx} d'un DOCX (buffer).
 * Gère les placeholders simples et pointés (ex: etude.nom).
 */
export function extractPlaceholders(buffer: ArrayBuffer | Buffer): string[] {
  const zip = new PizZip(buffer as any)
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })
  try {
    // API interne mais stable
    const tags: string[] = []
    const re = /\{([^{}]+)\}/g
    // Concatène les parties text XML
    const files = zip.file(/\.xml$/) as any[]
    const textAll = files.map((f) => f.asText()).join("\n")
    let m: RegExpExecArray | null
    while ((m = re.exec(textAll)) !== null) {
      const raw = m[1].trim()
      if (!raw) continue
      if (raw.startsWith("#") || raw.startsWith("/") || raw.startsWith("^") || raw.startsWith("@")) continue
      if (!tags.includes(raw)) tags.push(raw)
    }
    // Valide la syntaxe du template
    doc.compile?.()
    return tags
  } catch {
    return []
  }
}

/**
 * Remplit un DOCX avec les données fournies.
 */
export function renderDocx(
  templateBuffer: ArrayBuffer | Buffer,
  data: Record<string, any>
): Buffer {
  const zip = new PizZip(templateBuffer as any)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  })
  doc.render(data)
  const out = doc.getZip().generate({ type: "nodebuffer" })
  return out as Buffer
}
