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

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 })
  }

  const { filePath, fileName, name, description, category, placeholders } = body

  if (!filePath) return NextResponse.json({ error: "Chemin de fichier manquant" }, { status: 400 })
  if (!name?.trim()) return NextResponse.json({ error: "Nom requis" }, { status: 400 })

  const { data, error } = await sb
    .from("document_templates")
    .insert({
      name,
      description,
      category,
      file_path: filePath,
      file_name: fileName || "document.docx",
      placeholders: placeholders || [],
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error("DB insert error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data })
}
