export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiAdmin } from "@/lib/auth/api-guards"
import { extractPlaceholders } from "@/lib/docx/template-engine"
import { revalidateTag } from "next/cache"


const TEMPLATES_TAG = "document_templates"

// Allow up to 30 seconds for DOCX parsing + upload
export const maxDuration = 30

export async function POST(req: NextRequest) {
  // Création de template = opération d'administration : réservée aux admins.
  // Auparavant, tout compte authentifié (y compris intervenant/candidat)
  // pouvait créer un template servant à générer des documents officiels.
  const guard = await requireApiAdmin()
  if (!guard.ok) return guard.response

  const sb = createClient()

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
      created_by: guard.userId,
    })
    .select()
    .single()

  if (error) {
    console.error("DB insert error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  revalidateTag(TEMPLATES_TAG)
  return NextResponse.json({ data })
}
