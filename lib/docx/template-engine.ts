import PizZip from "pizzip"
import Docxtemplater from "docxtemplater"

import { numberToFrenchWords } from "./nombres"

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
 * - decimales:2 → round a number to N decimals (comma as separator)
 * - lettres → spell out a monetary amount in French words (ex: "mille cinq cents euros")
 */
function applyFilter(value: any, filterStr: string, scope: any): any {
  // Supports both quoted args (formatDate:'DD/MM/YYYY') and bare numeric args (decimales:2)
  const match = filterStr.match(/^(\w+)(?::(?:'([^']*)'|(\S+)))?$/)
  if (!match) return value

  const filterName = match[1]
  const arg = match[2] !== undefined ? match[2] : match[3]

  switch (filterName) {
    case "decimales": {
      const n = Number(value)
      if (isNaN(n)) return value ?? ""
      const decimals = arg !== undefined && !isNaN(parseInt(arg, 10)) ? parseInt(arg, 10) : 2
      return n.toFixed(decimals).replace(".", ",")
    }
    case "lettres": {
      const n = Number(value)
      if (isNaN(n)) return value ?? ""
      const sign = n < 0 ? "moins " : ""
      const euros = Math.floor(Math.abs(n) + 1e-9)
      const centimes = Math.round((Math.abs(n) - euros) * 100)
      const eurosWords = numberToFrenchWords(euros)
      // « zéro euro », « un euro », « deux euros »
      const unite = euros > 1 ? "euros" : "euro"
      return centimes > 0
        ? `${sign}${eurosWords} ${unite} et ${numberToFrenchWords(centimes)} centimes`
        : `${sign}${eurosWords} ${unite}`
    }
    case "formatDate": {
      // Champ absent/vide : ne JAMAIS retomber sur la date du jour (Date.now()) —
      // un document envoyé à un client afficherait silencieusement "aujourd'hui"
      // à la place d'une date métier jamais saisie.
      if (value === null || value === undefined || value === "") return ""
      let date: Date
      if (value instanceof Date) {
        date = value
      } else if (typeof value === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(value.trim())) {
        // Valeur déjà au format français DD/MM/YYYY — ne surtout pas laisser
        // new Date() la parser à l'américaine (jour et mois inversés)
        const [dd, mm, yyyy] = value.trim().split("/").map(Number)
        date = new Date(yyyy, mm - 1, dd)
      } else {
        date = new Date(value)
      }
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
    case "pluriel": {
      // {mission.nombre_jeh | pluriel} → "s" au pluriel, "" au singulier —
      // pour accorder "Jour{...} Etude Homme" sans dupliquer le champ.
      const n = Number(value)
      const suffix = arg || "s"
      return !isNaN(n) && Math.abs(n) > 1 ? suffix : ""
    }
    default:
      return value
  }
}

/**
 * Construit la séquence de runs OOXML d'un champ Word complexe NUMPAGES
 * (begin → instrText → separate → valeur en cache → end), en réutilisant les
 * attributs et le style (rPr) du run d'origine — sans la couleur "à remplir"
 * (rouge) qui n'a plus lieu d'être une fois le champ automatisé.
 */
function buildNumPagesFieldRuns(rAttrs: string, rPr?: string, suffixText?: string): string {
  const rPrClean = rPr ? rPr.replace(/<w:color[^/]*\/>/g, "") : ""
  const rPrTag = rPrClean ? `<w:rPr>${rPrClean}</w:rPr>` : ""
  const suffixRun = suffixText
    ? `<w:r${rAttrs}>${rPrTag}<w:t xml:space="preserve">${suffixText}</w:t></w:r>`
    : ""
  return (
    `<w:r${rAttrs}>${rPrTag}<w:fldChar w:fldCharType="begin"/></w:r>` +
    `<w:r${rAttrs}>${rPrTag}<w:instrText xml:space="preserve"> NUMPAGES </w:instrText></w:r>` +
    `<w:r${rAttrs}>${rPrTag}<w:fldChar w:fldCharType="separate"/></w:r>` +
    `<w:r${rAttrs}>${rPrTag}<w:t>1</w:t></w:r>` +
    `<w:r${rAttrs}>${rPrTag}<w:fldChar w:fldCharType="end"/></w:r>` +
    suffixRun
  )
}

// Bloc de propriétés d'un run limité à des balises auto-fermantes (rFonts, color,
// sz…) — borne volontairement le nettoyage pour ne jamais franchir la fin d'un
// run/paragraphe voisin (voir historique : un `[\s\S]*?` non borné avait fini
// par avaler ~100 000 caractères jusqu'au prochain "}</w:rPr>" du document).
const SIMPLE_RPR = `(?:<w:rPr>((?:<w:[a-zA-Z]+(?:\\s+[^<>]*)?\\/>)*)<\\/w:rPr>)?`
// Même chose mais sans groupe capturant, pour les runs de bordure dont on n'a
// pas besoin d'extraire le style (évite de décaler la numérotation des
// groupes capturants utilisés dans les callbacks de replace()).
const SIMPLE_RPR_NC = `(?:<w:rPr>(?:<w:[a-zA-Z]+(?:\\s+[^<>]*)?\\/>)*<\\/w:rPr>)?`

/**
 * Remplit un DOCX ou PPTX avec les données fournies.
 * Utilise un parseur Angular pour gérer les pipes et les chemins imbriqués.
 */
export function renderTemplate(
  templateBuffer: ArrayBuffer | Buffer,
  data: Record<string, any>,
  isPptx: boolean = false
): Buffer {
  const zip = new PizZip(templateBuffer as any)

  // Nettoyage des éléments invisibles qui peuvent casser un tag {balise}
  const cleanXml = (xml: string): string => {
    let cleaned = xml
    // Remove empty runs containing only invisible elements
    cleaned = cleaned.replace(/<w:r>(?:<w:(?:proofErr|rStyle|rsidR|rsidRPr|noProof|lang)[^>]*\/?>)*<\/w:r>/g, "")

    // Remove proof errors (spell check)
    cleaned = cleaned.replace(/<w:proofErr[^/]*\/>/g, "")
    cleaned = cleaned.replace(/<w:proofErr[^>]*>[\s\S]*?<\/w:proofErr>/g, "")

    // Remove bookmarks and comment ranges
    cleaned = cleaned.replace(/<w:bookmarkStart[^/]*\/>/g, "")
    cleaned = cleaned.replace(/<w:bookmarkEnd[^/]*\/>/g, "")
    cleaned = cleaned.replace(/<w:commentRangeStart[^/]*\/>/g, "")
    cleaned = cleaned.replace(/<w:commentRangeEnd[^/]*\/>/g, "")
    cleaned = cleaned.replace(/<w:commentReference[^/]*\/>/g, "")

    // Remove page breaks and rendering hints
    cleaned = cleaned.replace(/<w:lastRenderedPageBreak[^/]*\/>/g, "")
    cleaned = cleaned.replace(/<w:noProof[^/]*\/>/g, "")

    // Remove style attributes that don't affect structure
    cleaned = cleaned.replace(/<w:rStyle[^/]*\/>/g, "")
    cleaned = cleaned.replace(/<w:rsidR[^/]*\/>/g, "")
    cleaned = cleaned.replace(/<w:rsidRPr[^/]*\/>/g, "")
    cleaned = cleaned.replace(/<w:rsidSect[^/]*\/>/g, "")
    cleaned = cleaned.replace(/<w:lang[^/]*\/>/g, "")

    // Remove instruction texts (fields), sauf les champs de pagination Word
    // natifs (PAGE, NUMPAGES, SECTIONPAGES) : on les préserve pour que le
    // "Page X sur Y" reste un champ auto-calculé par Word après génération,
    // au lieu de se figer/vider.
    cleaned = cleaned.replace(
      /<w:instrText[^>]*>([\s\S]*?)<\/w:instrText>/g,
      (match, inner) => (/\b(PAGE|NUMPAGES|SECTIONPAGES)\b/.test(inner) ? match : "")
    )

    // Remplace le texte figé "[nombre de pages]" (pense-bête laissé dans les
    // templates, ex. "Document comportant [nombre de pages] pages") par un
    // vrai champ Word NUMPAGES, pour qu'il se remplisse automatiquement comme
    // en pied de page, sur n'importe quel template.
    cleaned = cleaned.replace(
      /<w:r\b([^>]*)>(?:<w:rPr>((?:<w:[a-zA-Z]+(?:\s+[^<>]*)?\/>)*)<\/w:rPr>)?<w:t[^>]*>\s*\[\s*nombre\s+de\s+pages?\s*\]\s*<\/w:t>\s*<\/w:r>/gi,
      (_match, rAttrs, rPr) => buildNumPagesFieldRuns(rAttrs, rPr)
    )

    // Autres pense-bêtes "Document de <espace réservé> pages" repérés sur
    // d'autres templates (PVRI/PVRF : run isolé "X pages" ; avenants : run
    // isolé "trois" avant "pages" dans un run séparé). Le run réservé est
    // isolé entre un run se terminant par "Document de"/"Document comportant"
    // et un run commençant par "page(s)" — peu importe son contenu exact.
    cleaned = cleaned.replace(
      new RegExp(
        `<w:r\\b[^>]*>${SIMPLE_RPR_NC}<w:t[^>]*>[^<]*?Document\\s+(?:de|comportant)\\s*<\\/w:t><\\/w:r>` +
          `(<w:r\\b([^>]*)>${SIMPLE_RPR}<w:t[^>]*>[^<{}]{1,20}?\\s*<\\/w:t><\\/w:r>)` +
          `<w:r\\b[^>]*>${SIMPLE_RPR_NC}<w:t[^>]*>\\s*pages?\\b[^<]*<\\/w:t><\\/w:r>`,
        "gi"
      ),
      (fullMatch, middleRun, rAttrs, rPr) => fullMatch.replace(middleRun, buildNumPagesFieldRuns(rAttrs, rPr))
    )

    // Variante où le mot-réservé et "pages" sont dans le MÊME run
    // (ex. PVRI/PVRF : un seul run "X pages ").
    cleaned = cleaned.replace(
      new RegExp(
        `(<w:r\\b[^>]*>${SIMPLE_RPR_NC}<w:t[^>]*>[^<]*?Document\\s+(?:de|comportant)\\s*<\\/w:t><\\/w:r>)` +
          `<w:r\\b([^>]*)>${SIMPLE_RPR}<w:t[^>]*>([^<{}]{1,20}?)(\\s+pages?\\b[^<]*)<\\/w:t><\\/w:r>`,
        "gi"
      ),
      (_fullMatch, prefixRun, rAttrs, rPr, _placeholder, suffixText) =>
        prefixRun + buildNumPagesFieldRuns(rAttrs, rPr, suffixText)
    )

    // PowerPoint elements
    cleaned = cleaned.replace(/<a:bookmarkStart[^/]*\/>/g, "")
    cleaned = cleaned.replace(/<a:bookmarkEnd[^/]*\/>/g, "")

    return cleaned
  }

  for (const file of Object.keys(zip.files)) {
    // Nettoyer les fichiers word (DOCX) ou ppt (PPTX)
    if ((/^word\/.*\.xml$/.test(file) || /^ppt\/.*\.xml$/.test(file)) && !file.includes("/_rels/")) {
      const xml = zip.files[file].asText()
      const cleaned = cleanXml(xml)
      if (cleaned !== xml) zip.file(file, cleaned)
    }
  }

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
    parser: angularParser,
    delimiters: { start: "{", end: "}" },
  })
  doc.render(data)
  const out = doc.getZip().generate({ type: "nodebuffer" })
  return out as Buffer
}
