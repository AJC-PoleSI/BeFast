import "server-only"

import { createClient } from "@/lib/supabase/server"
import { profileSchema } from "@/app/(dashboard)/dashboard/profil/_lib/schemas"
import { NextResponse } from "next/server"

export async function PATCH(request: Request) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = profileSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Check if admin is editing another user
    const url = new URL(request.url)
    const targetUserId = url.searchParams.get("targetUserId")
    let updateId = user.id

    if (targetUserId && targetUserId !== user.id) {
      // Verify admin role
      const { data: adminProfile } = await supabase
        .from("personnes")
        .select("profils_types(slug)")
        .eq("id", user.id)
        .single()

      const slug = (adminProfile?.profils_types as { slug?: string } | null)
        ?.slug
      if (slug !== "administrateur") {
        return NextResponse.json(
          { error: "Accès non autorisé" },
          { status: 403 }
        )
      }
      updateId = targetUserId
    }

    const { data, error } = await supabase
      .from("personnes")
      .update(parsed.data)
      .eq("id", updateId)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: "Erreur lors de la mise à jour" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    )
  }
}
