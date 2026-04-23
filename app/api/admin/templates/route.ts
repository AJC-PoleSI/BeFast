import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { extractPlaceholders } from "@/lib/docx/template-engine"

// Allow up to 30 seconds for DOCX parsing + upload
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 })
  }

  const file = form.get("file") as File | null
  const name = (form.get("name") as string) || ""
  const description = (form.get("description") as string) || ""
  const scope = (form.get("scope") as string) || "etude"
  const category = (form.get("category") as string) || ""

  if (!file) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 })
  if (!name.trim()) return NextResponse.json({ error: "Nom requis" }, { status: 400 })

  // Limit file size (10MB)
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 10 Mo)" }, { status: 400 })
  }

  let buffer: Buffer
  try {
    buffer = Buffer.from(await file.arrayBuffer())
  } catch {
    return NextResponse.json({ error: "Impossible de lire le fichier" }, { status: 400 })
  }

  let placeholders: string[] = []
  try {
    placeholders = extractPlaceholders(buffer)
  } catch (e: any) {
    console.error("DOCX parse error:", e)
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
  if (upErr) {
    console.error("Storage upload error:", upErr)
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

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
    // Clean up uploaded file on DB failure
    await sb.storage.from("templates").remove([filePath])
    console.error("DB insert error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data })
}
