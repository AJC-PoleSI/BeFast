import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { renderDocx } from "@/lib/docx/template-engine"
import { buildTemplateContext } from "@/lib/actions/documents"

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
  pv_recette_final: { code: "PVF", numbered: false },
  pv_recette_intermediaire: { code: "PVI", numbered: false },
  avenant_mission: { code: "AVM", numbered: true },
  rdm: { code: "RDM", numbered: true },
  avenant_rdm: { code: "AV", numbered: true },
  avenant_rupture_rdm: { code: "AVR", numbered: true },
  bulletin_versement: { code: "BV", numbered: true },
  questionnaire_satisfaction: { code: "QS", numbered: false },
  rapport_pedagogique: { code: "RP", numbered: false },
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
    scope: "etude" | "mission" | "personne" | "general"
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

  const { data: blob, error: dlErr } = await sb.storage.from("templates").download(tpl.file_path)
  if (dlErr || !blob) return NextResponse.json({ error: "DL template" }, { status: 500 })
  const templateBuf = Buffer.from(await blob.arrayBuffer())

  const context = await buildTemplateContext(scope, entity_id, intervenant_id)

  // Resolve étude info (numero + id) for naming/counting
  let etudeId: string | null = null
  let etudeNumero: string = ""
  if (scope === "etude") {
    etudeId = entity_id
    const { data: e } = await sb.from("etudes").select("numero").eq("id", entity_id).single()
    etudeNumero = (e as any)?.numero || ""
  } else if (scope === "mission") {
    const { data: m } = await sb
      .from("missions")
      .select("etude_id, etudes(numero)")
      .eq("id", entity_id)
      .single()
    etudeId = (m as any)?.etude_id || null
    etudeNumero = (m as any)?.etudes?.numero || ""
  }

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

  const numero_document = counter
  context.numero_document = numero_document

  let rendered: Buffer
  try {
    rendered = renderDocx(templateBuf, context)
  } catch (e: any) {
    return NextResponse.json(
      { error: "Erreur génération: " + (e?.message || "render error") },
      { status: 500 }
    )
  }

  // Build name: AA CODE[NN] NUMERO_ETUDE.docx
  // Examples: "26 CE 07.docx", "26 RDM08 07.docx"
  const codePart = codeInfo.numbered ? `${codeInfo.code}${pad2(counter)}` : codeInfo.code
  const baseName = [aa, codePart, numEtude].filter(Boolean).join(" ")
  const outName = `${baseName}.docx`
  const outPath = `${scope}/${entity_id}/${Date.now()}_${outName}`

  const { error: upErr } = await sb.storage.from("documents").upload(outPath, rendered, {
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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
