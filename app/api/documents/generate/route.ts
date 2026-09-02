export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { renderTemplate } from "@/lib/docx/template-engine"
import { buildTemplateContext } from "@/lib/actions/documents"
import { requireApiAdmin } from "@/lib/auth/api-guards"
import { getCachedProfile } from "@/lib/auth/cached-profile"
import { canEditEtude } from "@/lib/auth/permissions"


// Allow up to 30 seconds for DOCX rendering
export const maxDuration = 30

// Map template category → CODE_TYPE used in filename + whether to suffix a counter
const CATEGORY_CODES: Record<string, { code: string; numbered: boolean }> = {
  accord_confidentialite: { code: "AC", numbered: false },
  avant_projet: { code: "AP", numbered: false },
  bon_commande: { code: "BC", numbered: false },
  convention_cadre: { code: "CC", numbered: false },
  convention_client: { code: "CCL", numbered: false },
  convention_etude: { code: "CE", numbered: false },
  fiche_selection: { code: "FS", numbered: false },
  // Les PV sont numérotés par étude ("26 PVRI01 07") — cf. nomenclature SDP
  pv_recette_final: { code: "PVF", numbered: true },
  pv_recette_intermediaire: { code: "PVI", numbered: true },
  avenant_mission: { code: "AVM", numbered: true },
  rdm: { code: "RDM", numbered: true },
  avenant_rdm: { code: "AV", numbered: true },
  avenant_rupture_rdm: { code: "AVR", numbered: true },
  bulletin_versement: { code: "BV", numbered: true },
  questionnaire_satisfaction: { code: "QS", numbered: false },
  rapport_pedagogique: { code: "RP", numbered: false },
  // Les factures ont déjà leur propre numérotation (Trésorerie) — pas de compteur auto.
  facture: { code: "FA", numbered: false },
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9 _-]/g, "").replace(/\s+/g, " ").trim()
}

export async function POST(req: NextRequest) {
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const body = await req.json()
  const { template_id, scope, entity_id, intervenant_id } = body as {
    template_id: string
    scope: "etude" | "mission" | "personne" | "general" | "facture"
    entity_id: string
    intervenant_id?: string
  }

  if (!template_id || !scope || !entity_id) {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 })
  }

  const { data: tpl, error: tErr } = await sb
    .from("document_templates")
    .select("*")
    .eq("id", template_id)
    .single()
  if (tErr || !tpl) return NextResponse.json({ error: "Template introuvable" }, { status: 404 })

  // Le Bulletin de Versement embarque le NSS déchiffré de l'intervenant :
  // génération réservée aux administrateurs.
  if (tpl.category === "bulletin_versement") {
    const guard = await requireApiAdmin()
    if (!guard.ok) return guard.response
  }

  // Génération de documents liés à une étude/mission : réservée au créateur
  // de l'étude, au Pôle SI et aux admins — même règle que la modification de
  // l'étude (canEditEtude). On lit via le client admin pour ne pas dépendre
  // de la RLS "etudes read" (un non-interne, non-créateur ne verrait même
  // pas la ligne, et le check tomberait toujours en échec sans distinction).
  if (scope === "etude" || scope === "mission") {
    const admin = createAdminClient()
    let etudeCreatedBy: string | null = null

    if (scope === "etude") {
      const { data: e } = await admin.from("etudes").select("created_by").eq("id", entity_id).single()
      etudeCreatedBy = e?.created_by ?? null
    } else {
      const { data: m } = await admin.from("missions").select("etude_id").eq("id", entity_id).single()
      if (m?.etude_id) {
        const { data: e } = await admin.from("etudes").select("created_by").eq("id", m.etude_id).single()
        etudeCreatedBy = e?.created_by ?? null
      }
    }

    const profile = await getCachedProfile(user.id)
    if (!canEditEtude(profile, { created_by: etudeCreatedBy })) {
      return NextResponse.json(
        { error: "Seuls le créateur de l'étude, le Pôle SI et les administrateurs peuvent générer ce document." },
        { status: 403 }
      )
    }
  }

  // Téléchargement du fichier et construction du contexte en parallèle —
  // les deux sont indépendants et représentent l'essentiel de la latence.
  const [dlRes, context] = await Promise.all([
    sb.storage.from("templates").download(tpl.file_path),
    buildTemplateContext(scope, entity_id, intervenant_id, {
      includeNss: tpl.category === "bulletin_versement",
    }),
  ])
  if (dlRes.error || !dlRes.data) return NextResponse.json({ error: "DL template" }, { status: 500 })
  const templateBuf = Buffer.from(await dlRes.data.arrayBuffer())

  // Ne jamais journaliser le contenu du contexte : il contient des données
  // personnelles (noms, adresses, coordonnées) qui finiraient dans les logs.
  console.log("[DOC-GEN] scope:", scope, "template:", tpl.category)

  // Naming info — déjà présent dans le contexte, aucune requête supplémentaire
  const etudeId: string | null =
    scope === "etude" ? entity_id : (context as any).etude?.id || null
  const etudeNumero: string = (context as any).reference || ""
  const factureNumero: string = scope === "facture" ? (context as any).facturation?.numero || "" : ""

  // Year (last 2 digits) + étude number (last 2 digits)
  const aa = String(new Date().getFullYear()).slice(-2)
  const numEtude = etudeNumero.slice(-2)
  const codeInfo = CATEGORY_CODES[tpl.category as string] || { code: sanitize(tpl.category || "DOC").toUpperCase(), numbered: false }

  // Counter: count existing docs for this template across the étude (étude-scoped + mission-scoped of this étude)
  let counter = 1
  if (codeInfo.numbered && etudeId) {
    const { data: missionsOfEtude } = await sb
      .from("missions")
      .select("id")
      .eq("etude_id", etudeId)
    const missionIds = (missionsOfEtude || []).map((x: any) => x.id)
    const orFilters: string[] = [`and(scope.eq.etude,entity_id.eq.${etudeId})`]
    if (missionIds.length) {
      orFilters.push(`and(scope.eq.mission,entity_id.in.(${missionIds.join(",")}))`)
    }
    const { count } = await sb
      .from("generated_documents")
      .select("*", { count: "exact", head: true })
      .eq("template_id", template_id)
      .or(orFilters.join(","))
    counter = (count || 0) + 1
  }

  // Exposé aux templates ({numero_document}) au format "01", "02"…
  context.numero_document = pad2(counter)

  const isPptx = tpl.file_path.endsWith(".pptx")
  let rendered: Buffer
  try {
    rendered = renderTemplate(templateBuf, context, isPptx)
  } catch (e: any) {
    console.error("[DOC-GEN] Template rendering failed:", e?.message)
    return NextResponse.json(
      { error: "Erreur génération: " + (e?.message || "render error") },
      { status: 500 }
    )
  }

  const ext = isPptx ? ".pptx" : ".docx"
  const mimeType = isPptx 
    ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

  // Build name: AA CODE[NN] NUMERO_ETUDE.ext
  // Examples: "26 CE 07.docx", "26 RDM08 07.pptx"
  // Les factures utilisent directement leur propre numéro (Trésorerie), pas ce format.
  const codePart = codeInfo.numbered ? `${codeInfo.code}${pad2(counter)}` : codeInfo.code
  const baseName =
    scope === "facture" && factureNumero
      ? sanitize(factureNumero)
      : [aa, codePart, numEtude].filter(Boolean).join(" ")
  const outName = `${baseName}${ext}`
  const outPath = `${scope}/${entity_id}/${Date.now()}_${outName}`

  const { error: upErr } = await sb.storage.from("documents").upload(outPath, rendered, {
    contentType: mimeType,
    upsert: false,
  })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: row, error: insErr } = await sb
    .from("generated_documents")
    .insert({
      template_id,
      scope,
      entity_id,
      name: tpl.name,
      file_path: outPath,
      file_name: outName,
      created_by: user.id,
    })
    .select()
    .single()
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  return NextResponse.json({ data: row })
}
