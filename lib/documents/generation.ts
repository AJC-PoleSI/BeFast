import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { renderTemplate } from "../docx/template-engine"
import { numeroEtudeCourt, segmentRdmParent } from "../document-numbering"
import { createAdminClient } from "../supabase/admin"
import { CATEGORIES_AVENANT_RDM, CATEGORY_CODES, pad2 } from "./nomenclature"
import { construireAvenant, validerChampsAvenant, type ValeursAvenant } from "./avenants"

/**
 * Socle commun de la génération de documents : route unitaire
 * (app/api/documents/generate) et route groupée (generate-batch).
 * Les deux portent leurs propres contrôles d'accès ; ce module ne fait que
 * rendre, nommer, numéroter et enregistrer.
 */

export type ModeleDocument = {
  id: string
  name: string
  category: string | null
  file_path: string
}

export type SortieGeneration = { data: any } | { error: string; status: number }

/** Les noms de modèles portent un horodatage (`templates/1790…_x.docx`) : un chemin n'est jamais réécrit. */
const MODELES = new Map<string, Promise<Buffer>>()
const MODELES_MAX = 4

/**
 * Modèles Word de travail (docs/modeles), utilisés À LA PLACE de ceux de la base
 * UNIQUEMENT en développement local (`next dev`) : permet d'essayer un nouveau
 * modèle sans toucher à la production. Jamais actif en production.
 * `MODELES_LOCAUX=avenant_rdm,avenant_rupture_rdm` change la liste.
 */
const MODELES_LOCAUX: Record<string, string> = {
  avenant_rdm: "avenant-rdm-befast-v3.docx",
  avenant_rupture_rdm: "avenant-rupture-rdm-befast-v3.docx",
  avenant_mission: "avenant-convention-etude-befast-v1.docx",
}

function modeleLocal(category: string | null | undefined): Buffer | null {
  if (process.env.NODE_ENV === "production" || !category) return null
  const actifs = (process.env.MODELES_LOCAUX ?? "avenant_rdm").split(",").map((c) => c.trim())
  const fichier = MODELES_LOCAUX[category]
  if (!fichier || !actifs.includes(category)) return null
  const chemin = path.join(process.cwd(), "docs", "modeles", fichier)
  if (!fs.existsSync(chemin)) return null
  console.log("[DOC-GEN] modèle local (dev) :", fichier)
  return fs.readFileSync(chemin)
}

/**
 * Fichier du modèle, gardé en mémoire de l'instance : le RDM pèse ~6 Mo
 * (polices incorporées) et était re-téléchargé à chaque génération. À appeler
 * APRÈS avoir lu la ligne du modèle avec le client de l'utilisateur.
 */
export async function chargerModele(sb: SupabaseClient, filePath: string, category?: string | null): Promise<Buffer> {
  const local = modeleLocal(category)
  if (local) return local
  const connu = MODELES.get(filePath)
  if (connu) return connu
  const promesse = (async () => {
    const { data, error } = await sb.storage.from("templates").download(filePath)
    if (error || !data) throw new Error("DL template")
    return Buffer.from(await data.arrayBuffer())
  })()
  MODELES.set(filePath, promesse)
  promesse.catch(() => MODELES.delete(filePath))
  while (MODELES.size > MODELES_MAX) {
    const plusAncien = MODELES.keys().next().value
    if (plusAncien === undefined) break
    MODELES.delete(plusAncien)
  }
  return promesse
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9 _-]/g, "").replace(/\s+/g, " ").trim()
}

/**
 * État des compteurs d'une catégorie numérotée, lu en base. `suivant()` rend
 * le prochain numéro libre et l'avance localement : une génération groupée
 * attribue ainsi 01, 02, 03… sans relire la base pour chaque document.
 */
export async function ouvrirCompteurs(
  sb: SupabaseClient,
  tpl: ModeleDocument,
  scope: string,
  entityId: string,
  etudeId: string | null
): Promise<{ suivant: (rdmParent: string) => number }> {
  const codeInfo = CATEGORY_CODES[tpl.category as string]
  if (!codeInfo?.numbered) return { suivant: () => 1 }

  if (codeInfo.parentRdm) {
    // Avenant : le compteur repart de 1 à chaque RDM parent ("AV01" du RDM08,
    // "AV01" à nouveau du RDM09) — pas partagé avec le reste de l'étude, mais
    // partagé entre avenants et avenants de rupture d'un même RDM (AV01, AR02).
    const { data: docs } = await sb
      .from("generated_documents")
      .select("file_name, document_templates!inner(category)")
      .in("document_templates.category", CATEGORIES_AVENANT_RDM)
      .eq("scope", "mission")
      .eq("entity_id", entityId)
    const parParent = new Map<string, number>()
    for (const d of docs || []) {
      const p = segmentRdmParent((d as any).file_name)
      parParent.set(p, (parParent.get(p) ?? 0) + 1)
    }
    return {
      suivant: (rdmParent) => {
        const n = (parParent.get(rdmParent) ?? 0) + 1
        parParent.set(rdmParent, n)
        return n
      },
    }
  }

  // Autres catégories numérotées : compteur sur l'étude entière (documents de
  // l'étude + de ses missions).
  let courant = 1
  if (etudeId) {
    const { data: missionsOfEtude } = await sb.from("missions").select("id").eq("etude_id", etudeId)
    const missionIds = (missionsOfEtude || []).map((x: any) => x.id)
    const orFilters: string[] = [`and(scope.eq.etude,entity_id.eq.${etudeId})`]
    if (missionIds.length) {
      orFilters.push(`and(scope.eq.mission,entity_id.in.(${missionIds.join(",")}))`)
    }
    const { count } = await sb
      .from("generated_documents")
      .select("*", { count: "exact", head: true })
      .eq("template_id", tpl.id)
      .or(orFilters.join(","))
    courant = (count || 0) + 1
  }
  return { suivant: () => courant++ }
}

type ParamsPersistance = {
  sb: SupabaseClient
  userId: string
  tpl: ModeleDocument
  templateBuf: Buffer
  scope: string
  entityId: string
  context: Record<string, any>
  /** Numéro du document ; reçoit le n° de tentative (0, 1…) pour sauter une valeur en conflit. */
  compteur: (rdmParent: string, tentative: number) => Promise<number>
}

/**
 * Nom du document (sans extension) — « 26 AV01 RDM08 07 » : AA CODE[NN] [RDM parent] NUMERO_ETUDE.
 * Les factures utilisent directement leur propre numéro (Trésorerie).
 */
export function nomDocument(opts: {
  category: string | null
  scope: string
  numero: number
  rdmParent: string
  numeroEtude: string
  annee: string
  factureNumero?: string
}): string {
  const codeInfo = CATEGORY_CODES[opts.category as string] || {
    code: sanitize(opts.category || "DOC").toUpperCase(),
    numbered: false,
  }
  if (opts.scope === "facture" && opts.factureNumero) return sanitize(opts.factureNumero)
  const codePart = codeInfo.numbered ? `${codeInfo.code}${pad2(opts.numero)}` : codeInfo.code
  return [
    opts.annee,
    codePart,
    codeInfo.parentRdm ? opts.rdmParent : "",
    // Avenant à la convention d'étude : "26 AV01 CE03"
    codeInfo.parentCe ? `CE${opts.numeroEtude}` : opts.numeroEtude,
  ]
    .filter(Boolean)
    .join(" ")
}

/**
 * Rend le modèle, l'envoie dans le stockage et enregistre la ligne
 * `generated_documents`.
 *
 * Compteur + insertion sous forme de boucle de retry : deux générations
 * concurrentes pour la même étude peuvent lire le même compteur avant que
 * l'une des deux n'ait inséré sa ligne (audit du 2026-09-07). La contrainte
 * UNIQUE (scope, entity_id, file_name) — migration 063 — fait échouer la 2ᵉ
 * insertion : on retente avec le numéro suivant.
 */
export async function persisterDocument(p: ParamsPersistance): Promise<SortieGeneration> {
  const { sb, userId, tpl, templateBuf, scope, entityId, context } = p
  const codeInfo = CATEGORY_CODES[tpl.category as string] || { code: "", numbered: false }
  const isPptx = tpl.file_path.endsWith(".pptx")
  const ext = isPptx ? ".pptx" : ".docx"
  const mimeType = isPptx
    ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

  const aa = String(new Date().getFullYear()).slice(-2)
  const numeroEtude = numeroEtudeCourt(context.reference || "")
  const factureNumero: string = scope === "facture" ? context.facturation?.numero || "" : ""
  // Intervenant réellement utilisé pour remplir le document : affiché dans les
  // listes pour savoir qui il concerne, sans l'ajouter au nom du fichier.
  const intervenantConcerneId: string | null = context.intervenant?.id || null
  // Un avenant rappelle le RDM qu'il modifie (même source que {mission.reference_recap_mission}).
  const rdmParent = codeInfo.parentRdm ? segmentRdmParent(context.mission?.reference_recap_mission) : ""

  let row: any = null
  let lastErr: string | null = null
  for (let attempt = 0; attempt < 5 && !row; attempt++) {
    const numero = codeInfo.numbered ? await p.compteur(rdmParent, attempt) : 1
    const baseName = nomDocument({
      category: tpl.category,
      scope,
      numero,
      rdmParent,
      numeroEtude,
      annee: aa,
      factureNumero,
    })
    const outName = `${baseName}${ext}`
    const outPath = `${scope}/${entityId}/${Date.now()}_${attempt}_${outName}`

    // Exposé aux templates ({numero_document}) au format "01", "02"…
    context.numero_document = pad2(numero)
    // Référence complète du document, identique au nom du fichier ("26 RDM01 18") :
    // le document imprime exactement son propre nom.
    context.reference_document = baseName
    // Référence courte de l'avenant sans le RDM ("26 AV01 03"), citée dans la
    // phrase « modifiée par l'avenant … » de l'avenant au RDM.
    if (context.avenant) {
      context.avenant.reference_courte = [aa, codeInfo.numbered ? `${codeInfo.code}${pad2(numero)}` : codeInfo.code, numeroEtude]
        .filter(Boolean)
        .join(" ")
    }

    let rendered: Buffer
    try {
      rendered = renderTemplate(templateBuf, context, isPptx)
    } catch (e: any) {
      console.error("[DOC-GEN] Template rendering failed:", e?.message)
      return { error: "Erreur génération: " + (e?.message || "render error"), status: 500 }
    }

    const { error: upErr } = await sb.storage.from("documents").upload(outPath, rendered, {
      contentType: mimeType,
      upsert: false,
    })
    if (upErr) return { error: upErr.message, status: 500 }

    const { data: inserted, error: insErr } = await sb
      .from("generated_documents")
      .insert({
        template_id: tpl.id,
        scope,
        entity_id: entityId,
        name: tpl.name,
        file_path: outPath,
        file_name: outName,
        intervenant_id: intervenantConcerneId,
        created_by: userId,
      })
      .select()
      .single()

    if (!insErr) {
      row = inserted
      break
    }

    // Catégorie non numérotée (convention, bon de commande…) : le nom ne
    // dépend jamais du compteur, la collision est une RÉGÉNÉRATION normale du
    // même document : on remplace la ligne existante et son fichier.
    if ((insErr as { code?: string }).code === "23505" && !codeInfo.numbered) {
      const { data: existing } = await sb
        .from("generated_documents")
        .select("id, file_path")
        .eq("scope", scope)
        .eq("entity_id", entityId)
        .eq("file_name", outName)
        .maybeSingle()
      if (existing) {
        const { data: updated, error: updErr } = await sb
          .from("generated_documents")
          .update({
            template_id: tpl.id,
            name: tpl.name,
            file_path: outPath,
            intervenant_id: intervenantConcerneId,
            created_by: userId,
            created_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select()
          .single()
        if (!updErr) {
          await sb.storage.from("documents").remove([existing.file_path])
          row = updated
          break
        }
        lastErr = updErr.message
        await sb.storage.from("documents").remove([outPath])
        break
      }
    }

    // Nettoie le fichier orphelin de la tentative ratée avant de retenter.
    await sb.storage.from("documents").remove([outPath])
    lastErr = insErr.message
    if ((insErr as { code?: string }).code !== "23505") break
  }
  if (!row) return { error: lastErr || "Erreur génération", status: 500 }
  return { data: row }
}

/**
 * Droit de générer un document pour une étude ou une mission : créateur de
 * l'étude, ses suiveurs (chefs de projet), Pôle SI et administrateurs — même
 * règle que la modification de l'étude (canEditEtude). Lecture via le client
 * admin : un non-interne, non-créateur ne verrait pas la ligne sous RLS.
 * Une seule requête (mission → étude → suiveurs) au lieu de trois.
 */
export async function accesEtudeDe(
  scope: "etude" | "mission",
  entityId: string
): Promise<{ etudeId: string | null; acces: { created_by: string | null; suiveurs: { id: string }[] } }> {
  const admin = createAdminClient()
  const colonnes = "created_by, etude_suiveurs(personne_id)"
  let etudeId: string | null = null
  let etude: any = null
  if (scope === "etude") {
    const { data } = await admin.from("etudes").select(colonnes).eq("id", entityId).single()
    etudeId = data ? entityId : null
    etude = data
  } else {
    const { data } = await admin
      .from("missions")
      .select(`etude_id, etudes(${colonnes})`)
      .eq("id", entityId)
      .single()
    etudeId = (data as any)?.etude_id ?? null
    const e = (data as any)?.etudes
    etude = Array.isArray(e) ? e[0] : e
  }
  return {
    etudeId,
    acces: {
      created_by: etude?.created_by ?? null,
      suiveurs: (etude?.etude_suiveurs ?? []).map((s: { personne_id: string }) => ({ id: s.personne_id })),
    },
  }
}

// ------------------------------------------------------------------ avenants

export type AvenantExistant = { reference: string; categorie: string; rdmParent: string }

/**
 * Avenants déjà générés sur la cible (la mission pour les avenants au RDM, la
 * convention pour un avenant à la CE), du plus ancien au plus récent : ils
 * donnent « annule et remplace l'avenant 26 AV01 RDM01 03 ».
 */
export async function chargerAvenantsExistants(
  sb: SupabaseClient,
  category: string,
  scope: string,
  entityId: string
): Promise<AvenantExistant[]> {
  const categories = category === "avenant_mission" ? ["avenant_mission"] : CATEGORIES_AVENANT_RDM
  const { data } = await sb
    .from("generated_documents")
    .select("file_name, created_at, document_templates!inner(category)")
    .in("document_templates.category", categories)
    .eq("scope", scope)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: true })
  return (data || []).map((d: any) => {
    const modele = Array.isArray(d.document_templates) ? d.document_templates[0] : d.document_templates
    const reference = String(d.file_name).replace(/\.(docx|pdf|pptx)$/i, "")
    return { reference, categorie: modele?.category ?? "", rdmParent: segmentRdmParent(reference) }
  })
}

/**
 * Renseigne `{avenant.*}` dans le contexte d'UN document à partir des champs
 * saisis. Renvoie un message d'erreur si l'avenant ne peut pas être produit
 * (champs manquants, intervenant sans RDM), sinon null.
 */
export function appliquerAvenant(
  category: string,
  context: Record<string, any>,
  valeurs: ValeursAvenant,
  existants: AvenantExistant[]
): string | null {
  const erreurs = validerChampsAvenant(category, valeurs)
  if (erreurs.length > 0) return erreurs.join(" ")

  const rdmParent = segmentRdmParent(context.mission?.reference_recap_mission)
  const parRdm = category !== "avenant_mission"
  if (parRdm && !rdmParent) return "Aucun RDM généré pour cet intervenant : générez d'abord son RDM."

  context.avenant = construireAvenant(category, valeurs, {
    aujourdhuiISO: String(context.date_iso ?? ""),
    codeClasseur: String(context.code_classeur ?? ""),
    mission: {
      description: context.mission?.description,
      date_fin_iso: context.mission?.date_fin_iso,
      nombre_jeh: Number(context.mission?.nombre_jeh) || 0,
      montant_remuneration: Number(context.mission?.montant_remuneration) || 0,
    },
    avenantsExistants: existants
      .filter((a) => !parRdm || a.rdmParent === rdmParent)
      .map((a) => ({ reference: a.reference, categorie: a.categorie })),
  })
  return null
}
