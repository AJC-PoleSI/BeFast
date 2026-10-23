/**
 * Avenants : champs à saisir dans l'interface (au lieu de rédiger dans Word) et
 * construction de l'objet `{avenant.*}` injecté dans les modèles.
 *
 * Module pur (aucune dépendance serveur) : le même schéma sert au formulaire
 * (navigateur) et à la génération (routes /api/documents/generate*).
 *
 * Trois types, d'après les avenants réels de l'AJC :
 *   - avenant_rdm         « 26 AV01 RDM01 03 »  modifie le RDM d'UN intervenant
 *   - avenant_rupture_rdm « 26 AR02 RDM09 03 »  rompt le RDM d'UN intervenant
 *   - avenant_mission     « 26 AV01 CE03 »      modifie la convention d'étude
 *
 * Les formulations juridiques des alinéas (« L'article 2 du Récapitulatif de
 * Mission est annulé et remplacé par… ») vivent ici et non dans le .docx : le
 * nombre et la numérotation des alinéas dépendent de ce qui est coché.
 */
import { numberToFrenchWords } from "../docx/nombres"

export const CATEGORIES_AVENANT = new Set(["avenant_rdm", "avenant_rupture_rdm", "avenant_mission"])

export type ChampAvenant = {
  key: string
  label: string
  type: "text" | "textarea" | "date" | "number" | "checkbox" | "alineas"
  aide?: string
  obligatoire?: boolean
  /** Le champ n'apparaît (et n'est exigé) que si ce champ case à cocher est coché. */
  visibleSi?: string
  defaut?: string | number | boolean
  rows?: number
}

export type Alinea = { titre: string; article: string; texte: string }
export type ValeursAvenant = Record<string, string | number | boolean | Alinea[] | undefined>

export const CHAMPS_AVENANT: Record<string, ChampAvenant[]> = {
  avenant_rdm: [
    {
      key: "objet",
      label: "Objet de l'avenant (article 1)",
      type: "textarea",
      rows: 8,
      obligatoire: true,
      aide: "Rappel de ce qui était prévu, raisons de l'ajustement, objet de l'avenant. Une ligne = un paragraphe.",
    },
    { key: "modifier_mission", label: "Modifier la définition de la mission", type: "checkbox", defaut: true },
    {
      key: "mission_texte",
      label: "La mission de l'étudiant consiste en…",
      type: "text",
      visibleSi: "modifier_mission",
      aide: "Laissé vide : description de la mission.",
    },
    { key: "modifier_delai", label: "Modifier le délai", type: "checkbox", defaut: true },
    {
      key: "date_fin_nouvelle",
      label: "Nouvelle date de fin de mission",
      type: "date",
      visibleSi: "modifier_delai",
      obligatoire: true,
    },
    { key: "modifier_retribution", label: "Modifier la rétribution", type: "checkbox", defaut: false },
    { key: "nombre_jeh_nouveau", label: "Nouveau nombre de JEH", type: "number", visibleSi: "modifier_retribution", aide: "Laissé vide : JEH de la mission." },
    { key: "montant_brut_nouveau", label: "Nouvelle rétribution brute (€)", type: "number", visibleSi: "modifier_retribution", aide: "Laissé vide : rétribution de la mission." },
    { key: "date_document", label: "Date du document", type: "date", aide: "Laissé vide : date du jour." },
  ],
  avenant_rupture_rdm: [
    {
      key: "historique",
      label: "Historique et motifs de la rupture (1.1)",
      type: "textarea",
      rows: 6,
      obligatoire: true,
      aide: "Objectif initial, suivi réalisé, ce qui a conduit à la rupture. Une ligne = un paragraphe.",
    },
    {
      key: "constats",
      label: "Constats (optionnel)",
      type: "textarea",
      rows: 4,
      aide: "Une puce par ligne, au format « Titre : explication ».",
    },
    {
      key: "consequences",
      label: "Conséquences sur la rétribution (1.2)",
      type: "textarea",
      rows: 3,
      obligatoire: true,
      defaut:
        "Les parties conviennent que la mission est rompue sans donner lieu à aucune rétribution financière. L'intervenant renonce par le présent avenant à toute rétribution au titre de la mission.",
    },
    { key: "phases_realisees", label: "Phases réalisées", type: "textarea", rows: 2, obligatoire: true, defaut: "Aucune phase n'a été validée." },
    { key: "jeh_realises", label: "JEH réalisés", type: "number", obligatoire: true, defaut: 0 },
    { key: "livrables", label: "Livrables réalisés", type: "textarea", rows: 2, obligatoire: true, defaut: "Aucun livrable exploitable" },
    { key: "montant_brut", label: "Rétribution brute due (€)", type: "number", obligatoire: true, defaut: 0 },
    { key: "date_document", label: "Date du document", type: "date", aide: "Laissé vide : date du jour." },
  ],
  avenant_mission: [
    { key: "rappel_initial", label: "Ce qui était initialement convenu", type: "textarea", rows: 3, obligatoire: true },
    { key: "motifs", label: "Motifs de l'ajustement", type: "textarea", rows: 6, obligatoire: true, aide: "Une ligne = un paragraphe." },
    { key: "conclusion", label: "Ce que l'ajustement rend nécessaire", type: "textarea", rows: 3, obligatoire: true },
    { key: "objet_resume", label: "Objet de l'avenant (résumé)", type: "textarea", rows: 2, obligatoire: true },
    { key: "alineas", label: "Alinéas modifiés", type: "alineas", obligatoire: true },
    { key: "date_document", label: "Date du document", type: "date", aide: "Laissé vide : date du jour." },
  ],
}

export function valeursParDefaut(category: string): ValeursAvenant {
  const v: ValeursAvenant = {}
  for (const c of CHAMPS_AVENANT[category] ?? []) {
    if (c.type === "alineas") v[c.key] = []
    else if (c.defaut !== undefined) v[c.key] = c.defaut
  }
  return v
}

const vide = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "")

/** Messages d'erreur (vide = valide) — contrôle partagé formulaire / serveur. */
export function validerChampsAvenant(category: string, valeurs: ValeursAvenant): string[] {
  const erreurs: string[] = []
  const champs = CHAMPS_AVENANT[category] ?? []
  for (const c of champs) {
    if (c.visibleSi && !valeurs[c.visibleSi]) continue
    if (c.type === "alineas") {
      const liste = (valeurs[c.key] as Alinea[] | undefined) ?? []
      if (c.obligatoire && liste.length === 0) erreurs.push("Ajoutez au moins un alinéa modifié.")
      liste.forEach((a, i) => {
        if (vide(a.titre) || vide(a.article) || vide(a.texte)) {
          erreurs.push(`Alinéa ${i + 1} : titre, article et texte sont requis.`)
        }
      })
    } else if (c.obligatoire && c.type !== "checkbox" && vide(valeurs[c.key])) {
      erreurs.push(`« ${c.label} » est requis.`)
    }
  }
  if (category === "avenant_rdm" && !valeurs.modifier_mission && !valeurs.modifier_delai && !valeurs.modifier_retribution) {
    erreurs.push("Cochez au moins un alinéa à modifier (mission, délai ou rétribution).")
  }
  return erreurs
}

// ---------------------------------------------------------------- formats

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]

function parseISO(iso: unknown): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""))
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}
/** « 2026-04-12 » → « 12/04/2026 » (chaîne vide si absent). */
export function dateCourte(iso: unknown): string {
  const d = parseISO(iso)
  return d ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}` : ""
}
/** « 2026-04-12 » → « 12 avril 2026 ». */
export function dateLongue(iso: unknown): string {
  const d = parseISO(iso)
  return d ? `${d.getDate() === 1 ? "1er" : d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}` : ""
}

/** 0 → « zéro euro », 1 → « un euro », 311 → « trois cent onze euros ». */
export function montantEnLettres(n: number): string {
  const euros = Math.floor(Math.abs(n) + 1e-9)
  const centimes = Math.round((Math.abs(n) - euros) * 100)
  const unite = euros > 1 ? "euros" : "euro"
  const base = `${n < 0 ? "moins " : ""}${numberToFrenchWords(euros)} ${unite}`
  return centimes > 0 ? `${base} et ${numberToFrenchWords(centimes)} centimes` : base
}

const nombre = (v: unknown): number | null => {
  if (vide(v)) return null
  const n = Number(String(v).replace(",", "."))
  return Number.isFinite(n) ? n : null
}
const fmtNombre = (n: number) => String(n).replace(".", ",")

/** Découpe un texte libre en paragraphes (une ligne non vide = un paragraphe). */
function paragraphes(texte: unknown): { texte: string }[] {
  return String(texte ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((texte) => ({ texte }))
}

// ------------------------------------------------------------- construction

/** Données du contexte du document nécessaires pour pré-remplir et référencer. */
export type ContexteAvenant = {
  /** Date du jour (ISO), pour `date_document` vide. */
  aujourdhuiISO: string
  /** Code classeur à 4 chiffres de l'étude ("2603"). */
  codeClasseur: string
  mission: { description?: string; date_fin_iso?: string; nombre_jeh?: number; montant_remuneration?: number }
  /**
   * Références (sans extension) des avenants déjà générés sur la même cible,
   * du plus ancien au plus récent : ceux du RDM de l'intervenant pour AV/AR,
   * ceux de la convention pour un avenant à la CE.
   */
  avenantsExistants: { reference: string; categorie: string }[]
}

/** « 2603 » → « 26CE03 » : référence de la convention d'étude citée dans les avenants. */
export function referenceConvention(codeClasseur: string): string {
  return codeClasseur.length >= 4 ? `${codeClasseur.slice(0, 2)}CE${codeClasseur.slice(2)}` : ""
}

type AlineaRendu = { numero: number; titre: string; intro: string; texte: string }

/**
 * Objet `{avenant.*}` pour un modèle. Les champs vides reprennent les données
 * de la mission (description, date de fin, JEH, rétribution) pour que le
 * formulaire reste court.
 */
export function construireAvenant(category: string, valeurs: ValeursAvenant, ctx: ContexteAvenant): Record<string, any> {
  const dateISO = parseISO(valeurs.date_document) ? valeurs.date_document : ctx.aujourdhuiISO
  const convention = referenceConvention(ctx.codeClasseur)
  const precedent = ctx.avenantsExistants.length ? ctx.avenantsExistants[ctx.avenantsExistants.length - 1].reference : ""
  const commun = {
    // « 11 mars 2026 » (les avenants signés l'écrivent ainsi) ; version courte en plus.
    date_document: dateLongue(dateISO),
    date_document_courte: dateCourte(dateISO),
    convention,
    a_precedent: precedent !== "",
    precedent_ref: precedent,
  }

  if (category === "avenant_rdm") {
    const alineas: AlineaRendu[] = []
    const ajout = (titre: string, intro: string, texte: string) =>
      alineas.push({ numero: alineas.length + 1, titre, intro, texte })

    if (valeurs.modifier_mission) {
      const consiste = String(valeurs.mission_texte ?? "").trim() || String(ctx.mission.description ?? "").trim()
      ajout(
        "Définition de la Mission",
        "L’article 1 du Récapitulatif de Mission est annulé et remplacé par :",
        `« Article 1 : Définition de la mission\n` +
          `Conformément à la Convention d’Etude ${convention}, la mission de l’Étudiant consiste en ${consiste}.\n` +
          `L’Étudiant s’engage à respecter les termes de la Convention d’Etude ${convention}` +
          `${precedent ? ` et de l’Avenant ${precedent}` : ""}, ` +
          `et les éventuels Avenants qui y sont associés, liant Audencia Junior Conseil et le Client, dont il déclare avoir pris connaissance.\n` +
          `En parallèle, il s’engage à respecter les obligations définies dans son Bulletin d’Adhésion. »`
      )
    }
    if (valeurs.modifier_delai) {
      ajout(
        "Délais",
        "L’article 2 du Récapitulatif de Mission est annulé et remplacé par :",
        `« Article 2 : Délais\n` +
          `L’Étudiant réalisera sa mission au plus tard pour le ${dateLongue(valeurs.date_fin_nouvelle)} sauf cas de force majeure ou cause externe. »`
      )
    }
    let montant: number | null = null
    let jeh: number | null = null
    if (valeurs.modifier_retribution) {
      montant = nombre(valeurs.montant_brut_nouveau) ?? ctx.mission.montant_remuneration ?? 0
      jeh = nombre(valeurs.nombre_jeh_nouveau) ?? ctx.mission.nombre_jeh ?? 0
      ajout(
        "Rétribution",
        "L’article 3 du Récapitulatif de Mission est annulé et remplacé par :",
        `« Article 3 : Indemnisation\n` +
          `Les parties conviennent que l’indemnisation versée à l’Étudiant par Audencia Junior Conseil sera de ${fmtNombre(montant)} € bruts ` +
          `(${montantEnLettres(montant)} ${montant > 1 ? "bruts" : "brut"}), sur la base de ${fmtNombre(jeh)} Jour${jeh > 1 ? "s" : ""}-Étude Homme conformément à la législation en vigueur. »`
      )
    }
    return {
      ...commun,
      objet: String(valeurs.objet ?? ""),
      objet_paragraphes: paragraphes(valeurs.objet),
      alineas,
    }
  }

  if (category === "avenant_rupture_rdm") {
    const jeh = nombre(valeurs.jeh_realises) ?? 0
    const montant = nombre(valeurs.montant_brut) ?? 0
    const constats = String(valeurs.constats ?? "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const i = l.indexOf(":")
        return i > 0 ? { titre: l.slice(0, i).trim() + " :", texte: l.slice(i + 1).trim() } : { titre: "", texte: l }
      })
    const annules = ctx.avenantsExistants.filter((a) => a.categorie === "avenant_rdm").map((a) => a.reference)
    return {
      ...commun,
      historique_paragraphes: paragraphes(valeurs.historique),
      constats,
      a_constats: constats.length > 0,
      consequences: String(valeurs.consequences ?? ""),
      phases_realisees: String(valeurs.phases_realisees ?? ""),
      jeh_realises: fmtNombre(jeh),
      jeh_pluriel: jeh > 1 ? "s" : "",
      livrables: String(valeurs.livrables ?? ""),
      montant_brut: fmtNombre(montant),
      montant_lettres: montantEnLettres(montant),
      // « zéro euro brut », « trois cent onze euros bruts »
      accord_brut: montant > 1 ? "bruts" : "brut",
      a_avenants_annules: annules.length > 0,
      avenants_annules: annules.join(", "),
    }
  }

  // avenant_mission — avenant à la convention d'étude
  const alineas: AlineaRendu[] = ((valeurs.alineas as Alinea[] | undefined) ?? []).map((a, i) => ({
    numero: i + 1,
    titre: a.titre.trim(),
    intro: `L’article ${a.article.trim()} de la Convention d’Etude est annulé et remplacé par :`,
    texte: a.texte.trim(),
  }))
  return {
    ...commun,
    rappel_initial: String(valeurs.rappel_initial ?? ""),
    motifs_paragraphes: paragraphes(valeurs.motifs),
    conclusion: String(valeurs.conclusion ?? ""),
    objet_resume: String(valeurs.objet_resume ?? ""),
    alineas,
  }
}
