export const dynamic = "force-dynamic"

import "server-only"

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireApiAdmin } from "@/lib/auth/api-guards"


export async function GET() {
  try {
    const guard = await requireApiAdmin()
    if (!guard.ok) return guard.response

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
