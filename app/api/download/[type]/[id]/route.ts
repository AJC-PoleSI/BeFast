import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSignedDownloadUrl } from "@/lib/scaleway/client"
import { getCachedProfile } from "@/lib/auth/cached-profile"
import { hasPermission } from "@/lib/auth/permissions"

export async function GET(req: NextRequest, { params }: { params: { type: string, id: string } }) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const { type, id } = params

    let fileValue = ""

    if (type === "notes-de-frais") {
      const { data: note } = await supabase
        .from("notes_de_frais")
        .select("fichiers_justificatifs, intervenant_id")
        .eq("id", id)
        .single()

      if (!note) {
        return NextResponse.json({ error: "Document introuvable" }, { status: 404 })
      }

      // Contrôle d'accès : propriétaire de la note, ou permission `voir_factures`
      // (admin + trésorerie, poste-aware). Empêche l'IDOR sur les justificatifs.
      const profile = await getCachedProfile(user.id)
      const isPrivileged = hasPermission(profile, "voir_factures")

      if (note.intervenant_id !== user.id && !isPrivileged) {
        return NextResponse.json({ error: "Accès interdit" }, { status: 403 })
      }

      if (note.fichiers_justificatifs && note.fichiers_justificatifs.length > 0) {
        fileValue = note.fichiers_justificatifs[0]
      }
    }

    if (!fileValue) {
      return NextResponse.json({ error: "Document introuvable" }, { status: 404 })
    }

    // Objet privé : redirige vers une URL présignée à courte durée.
    const signed = await getSignedDownloadUrl(fileValue)
    return NextResponse.redirect(signed)

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
