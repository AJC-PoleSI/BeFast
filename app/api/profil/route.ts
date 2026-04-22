import "server-only"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
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

    // Get current user role
    const { data: userProfile } = await supabase
      .from("personnes")
      .select("profils_types(slug)")
      .eq("id", user.id)
      .single()

    const currentUserSlug = (userProfile?.profils_types as { slug?: string } | null)?.slug
    const isAdmin = currentUserSlug === "administrateur"

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
      if (!isAdmin) {
        return NextResponse.json(
          { error: "Accès non autorisé" },
          { status: 403 }
        )
      }
      updateId = targetUserId
    }

    // Filter data and apply protections
    const dataToUpdate = Object.entries(parsed.data).reduce((acc, [key, value]) => {
      // Protection du pôle : seul un admin peut le modifier
      if (key === "pole" && !isAdmin) {
        return acc
      }

      if (value === "") {
        acc[key] = null
      } else {
        acc[key] = value
      }
      return acc
    }, {} as Record<string, any>)

    const admin = createAdminClient()
    const { data, error } = await admin
      .from("personnes")
      .update(dataToUpdate)
      .eq("id", updateId)
      .select()
      .single()

    if (error) {
      console.error("Profile update error:", error)
      return NextResponse.json(
        { error: "Erreur lors de la mise à jour (Vérifiez que les colonnes existent en base)" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error("Internal profile error:", err)
    return NextResponse.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    )
  }
}
