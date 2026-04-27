import PizZip from "pizzip"
import Docxtemplater from "docxtemplater"

export { extractPlaceholders } from "./placeholders"

/**
 * Custom angular parser for docxtemplater.
 * Handles:
 * - Simple values: {etude.nom}
 * - Pipe filters: {today | formatDate:'DD/MM/YYYY'}, {president | sexe:'e'}
 * - Underscore-separated fallbacks: {etudiant_prenom}
 * - Scope chain traversal: variables like {date} work inside {#phases} loops
 */
function angularParser(tag: string) {
  tag = tag.trim()

  function resolveWithChain(scope: any, context: any, path: string): any {
    // Try current scope first
    let val = resolveValue(scope, path)
    // If not found, walk up the scope chain (needed inside loops)
    if (val === undefined && context?.scopeList) {
      for (let i = context.scopeList.length - 1; i >= 0; i--) {
        val = resolveValue(context.scopeList[i], path)
        if (val !== undefined) break
      }
    }
    return val
  }

  // Handle pipe filters
  if (tag.includes("|")) {
    const [expression, ...filters] = tag.split("|").map((s) => s.trim())

    return {
      get: (scope: any, context: any) => {
        let value = resolveWithChain(scope, context, expression)
        for (const filter of filters) {
          value = applyFilter(value, filter, scope)
        }
        return value ?? ""
      },
    }
  }

  // Standard dot/underscore notation
  return {
    get: (scope: any, context: any) => {
      return resolveWithChain(scope, context, tag) ?? ""
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
