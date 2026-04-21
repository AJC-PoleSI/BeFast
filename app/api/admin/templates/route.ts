import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { extractPlaceholders } from "@/lib/docx/template-engine"

export async function POST(req: NextRequest) {
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const form = await req.formData()
  const file = form.get("file") as File | null
  const name = (form.get("name") as string) || ""
  const description = (form.get("description") as string) || ""
  const scope = (form.get("scope") as string) || "etude"
  const category = (form.get("category") as string) || ""

  if (!file) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 })
  if (!name.trim()) return NextResponse.json({ error: "Nom requis" }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  let placeholders: string[] = []
  try {
    placeholders = extractPlaceholders(buffer)
  } catch (e: any) {
    return NextResponse.json(
      { error: "DOCX invalide: " + (e?.message || "parse error") },
      { status: 400 }
    )
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const filePath = `${scope}/${Date.now()}_${safeName}`

  const { error: upErr } = await sb.storage
    .from("templates")
    .upload(filePath, buffer, {
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: false,
    })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data, error } = await sb
    .from("document_templates")
    .insert({
      name,
      description,
      scope,
      category,
      file_path: filePath,
      file_name: file.name,
      placeholders,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    await sb.storage.from("templates").remove([filePath])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data })
}
