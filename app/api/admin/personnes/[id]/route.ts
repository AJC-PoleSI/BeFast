import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const body = await request.json()
    const { account_status, rejection_reason } = body

    if (!account_status) {
      return NextResponse.json({ error: "account_status required" }, { status: 400 })
    }

    // Contrôle d'accès : seul un administrateur peut valider / rejeter un compte.
    const userClient = createClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const supabase = createAdminClient()
    const { data: caller } = await supabase
      .from("personnes")
      .select("profils_types(slug)")
      .eq("id", user.id)
      .single()
    if ((caller?.profils_types as any)?.slug !== "administrateur") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
    }

    // Construit le patch en fonction du statut visé.
    const patch: Record<string, unknown> = { account_status }
    if (account_status === "rejected") {
      patch.rejection_reason = rejection_reason?.trim() || null
      patch.rejected_at = new Date().toISOString()
      patch.rejected_by = user.id
    } else {
      // Validation / repassage en attente : on efface toute trace de rejet.
      patch.rejection_reason = null
      patch.rejected_at = null
      patch.rejected_by = null
    }

    const { data, error } = await supabase
      .from("personnes")
      .update(patch)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, personne: data })
  } catch (e: any) {
    console.error("API error:", e)
    return NextResponse.json({ error: e.message || "Erreur serveur" }, { status: 500 })
  }
}
