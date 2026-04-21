import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { renderDocx } from "@/lib/docx/template-engine"
import { buildTemplateContext } from "@/lib/actions/documents"

export async function POST(req: NextRequest) {
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const body = await req.json()
  const { template_id, scope, entity_id } = body as {
    template_id: string
    scope: "etude" | "mission" | "personne" | "general"
    entity_id: string
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

  const context = await buildTemplateContext(scope, entity_id)

  let rendered: Buffer
  try {
    rendered = renderDocx(templateBuf, context)
  } catch (e: any) {
    return NextResponse.json(
      { error: "Erreur génération: " + (e?.message || "render error") },
      { status: 500 }
    )
  }

  const outName = `${tpl.name.replace(/[^a-zA-Z0-9._-]/g, "_")}_${Date.now()}.docx`
  const outPath = `${scope}/${entity_id}/${outName}`

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
