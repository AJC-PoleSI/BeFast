import "server-only"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function DELETE(
  request: Request,
  { params }: { params: { docId: string } }
) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const admin = createAdminClient()

    // Fetch document and verify ownership
    const { data: doc, error: fetchError } = await admin
      .from("documents_personnes")
      .select("*")
      .eq("id", params.docId)
      .single()

    if (fetchError || !doc) {
      return NextResponse.json(
        { error: "Document introuvable" },
        { status: 404 }
      )
    }

    if (doc.personne_id !== user.id) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      )
    }

    // Delete file from storage
    const { error: storageError } = await admin.storage
      .from("documents-personnes")
      .remove([doc.file_path])

    if (storageError) {
      console.error("Storage delete error:", storageError)
    }

    // Delete database record
    const { error: dbError } = await admin
      .from("documents_personnes")
      .delete()
      .eq("id", params.docId)

    if (dbError) {
      return NextResponse.json(
        { error: "Erreur lors de la suppression" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    )
  }
}
