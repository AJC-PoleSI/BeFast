import "server-only"

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
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

    const admin = createAdminClient()
    
    // Fetch all documents joined with personne details
    const { data, error } = await admin
      .from("documents_personnes")
      .select(`
        *,
        personnes:personne_id(
          id, prenom, nom, email
        )
      `)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: "Erreur lors de la récupération des documents" },
        { status: 500 }
      )
    }

    return NextResponse.json({ documents: data })
  } catch {
    return NextResponse.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    )
  }
}
