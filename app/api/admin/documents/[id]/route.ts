import "server-only"

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    // Verify admin role
    const { data: adminProfile } = await supabase
      .from("personnes")
      .select("profils_types(slug)")
      .eq("id", user.id)
      .single()

    const slug = (adminProfile?.profils_types as { slug?: string } | null)?.slug
    if (slug !== "administrateur") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }

    const body = await request.json()
    const { status } = body

    if (!["approved", "rejected", "pending"].includes(status)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 })
    }

    const admin = createAdminClient()
    const documentId = params.id

    const { data, error } = await admin
      .from("documents_personnes")
      .update({ status })
      .eq("id", documentId)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: "Erreur lors de la mise à jour du document" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, document: data })
  } catch {
    return NextResponse.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    )
  }
}
