import PizZip from "pizzip"
import Docxtemplater from "docxtemplater"

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

/**
 * Custom angular parser for docxtemplater.
 * Handles:
 * - Simple values: {etude.nom}
 * - Pipe filters: {today | formatDate:'DD/MM/YYYY'}, {president | sexe:'e'}
 * - Underscore-separated fallbacks: {etudiant_prenom}
 */
function angularParser(tag: string) {
  tag = tag.trim()
  
  // Handle pipe filters
  if (tag.includes("|")) {
    const [expression, ...filters] = tag.split("|").map((s) => s.trim())
    
    return {
      get: (scope: any, context: any) => {
        // Resolve the base value
        let value = resolveValue(scope, expression)
        
        // Apply each filter
        for (const filter of filters) {
          value = applyFilter(value, filter, scope)
        }
        return value ?? ""
      },
    }
  }
  
  // Standard dot/underscore notation
  return {
    get: (scope: any) => {
      return resolveValue(scope, tag) ?? ""
    },
  }
}

/**
 * Resolve a dotted or underscored path against a data scope.
 * e.g., "etude.nom" → scope.etude.nom
 *       "etudiant_prenom" → scope.etudiant_prenom OR scope.etudiant.prenom
 */
function resolveValue(scope: any, path: string): any {
  if (!scope || !path) return undefined
  
  // Try direct property first (e.g., "reference", "today")
  if (path in scope) return scope[path]
  
  // Try dot-separated path (e.g., "etude.nom")
  if (path.includes(".")) {
    const parts = path.split(".")
    let current = scope
    for (const part of parts) {
      if (current == null) return undefined
      current = current[part]
    }
    return current
  }
  
  // Try underscore-separated as dot-separated (e.g., "etudiant_prenom" → scope.etudiant.prenom)
  if (path.includes("_")) {
    const parts = path.split("_")
    // Try progressive nesting: etudiant_prenom → scope.etudiant?.prenom
    for (let i = 1; i < parts.length; i++) {
      const prefix = parts.slice(0, i).join("_")
      const suffix = parts.slice(i).join("_")
      if (scope[prefix] && typeof scope[prefix] === "object" && suffix in scope[prefix]) {
        return scope[prefix][suffix]
      }
    }
  }
  
  return undefined
}

/**
 * Apply a filter to a value.
 * Supported filters:
 * - formatDate:'DD/MM/YYYY' → format a date
 * - sexe:'e' → return 'e' if scope indicates female
 */
function applyFilter(value: any, filterStr: string, scope: any): any {
  const match = filterStr.match(/^(\w+)(?::'([^']*)')?$/)
  if (!match) return value
  
  const [, filterName, arg] = match
  
  switch (filterName) {
    case "formatDate": {
      const date = value instanceof Date ? value : new Date(value || Date.now())
      if (isNaN(date.getTime())) return value || ""
      const format = arg || "DD/MM/YYYY"
      const dd = String(date.getDate()).padStart(2, "0")
      const mm = String(date.getMonth() + 1).padStart(2, "0")
      const yyyy = String(date.getFullYear())
      return format
        .replace("DD", dd)
        .replace("MM", mm)
        .replace("YYYY", yyyy)
    }
    case "sexe": {
      // If the value is a scope object (like president), look for genre/civilite
      const suffix = arg || "e"
      let isFemale = false
      if (typeof value === "object" && value) {
        isFemale = value.genre === "F" || value.civilite === "Madame" || value.titre === "Madame"
      } else if (typeof value === "string") {
        isFemale = value === "F" || value === "Madame"
      }
      return isFemale ? suffix : ""
    }
    default:
      return value
  }
}

/**
 * Remplit un DOCX avec les données fournies.
 * Utilise un parseur Angular pour gérer les pipes et les chemins imbriqués.
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
    parser: angularParser,
  })
  doc.render(data)
  const out = doc.getZip().generate({ type: "nodebuffer" })
  return out as Buffer
}
