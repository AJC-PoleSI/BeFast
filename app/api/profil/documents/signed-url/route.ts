import "server-only"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const body = await request.json()
    const { filePath } = body

    if (!filePath || typeof filePath !== "string") {
      return NextResponse.json(
        { error: "Chemin du fichier requis" },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // Verify ownership or admin role
    const { data: doc } = await admin
      .from("documents_personnes")
      .select("personne_id")
      .eq("file_path", filePath)
      .single()

    if (!doc) {
      return NextResponse.json(
        { error: "Document introuvable" },
        { status: 404 }
      )
    }

    if (doc.personne_id !== user.id) {
      // Check if admin OR has voir_documents_membres permission
      // Use admin client to bypass RLS on personnes table
      const { data: requesterProfile } = await admin
        .from("personnes")
        .select("profils_types(slug, permissions)")
        .eq("id", user.id)
        .single()

      const profileType = requesterProfile?.profils_types as { slug?: string; permissions?: Record<string, boolean> } | null
      const isAdmin = profileType?.slug === "administrateur"
      const canViewMemberDocs = profileType?.permissions?.["voir_documents_membres"] === true

      if (!isAdmin && !canViewMemberDocs) {
        return NextResponse.json(
          { error: "Accès non autorisé" },
          { status: 403 }
        )
      }
    }

    const { data: signedUrlData, error } = await admin.storage
      .from("documents-personnes")
      .createSignedUrl(filePath, 3600) // 1 hour

    if (error) {
      return NextResponse.json(
        { error: "Erreur lors de la génération de l'URL" },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: signedUrlData.signedUrl })
  } catch {
    return NextResponse.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    )
  }
}
