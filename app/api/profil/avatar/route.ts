import "server-only"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

const MAX_AVATAR_SIZE = 2 * 1024 * 1024 // 2 Mo

export async function POST(request: Request) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json(
        { error: "Aucun fichier fourni" },
        { status: 400 }
      )
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Le fichier doit être une image" },
        { status: 400 }
      )
    }

    if (file.size > MAX_AVATAR_SIZE) {
      return NextResponse.json(
        { error: "Le fichier ne doit pas dépasser 2 Mo" },
        { status: 400 }
      )
    }

    const ext = file.name.split(".").pop() || "jpg"
    const filePath = `${user.id}/avatar.${ext}`

    const admin = createAdminClient()

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await admin.storage
      .from("avatars")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json(
        { error: "Erreur lors de l'upload" },
        { status: 500 }
      )
    }

    const {
      data: { publicUrl },
    } = admin.storage.from("avatars").getPublicUrl(filePath)

    // Append cache-buster so browser reloads the image even if the filename is identical
    const urlWithCache = `${publicUrl}?t=${Date.now()}`

    // Update personnes.avatar_url
    const { error: updateError } = await admin
      .from("personnes")
      .update({ avatar_url: urlWithCache })
      .eq("id", user.id)

    if (updateError) {
      return NextResponse.json(
        { error: "Erreur lors de la mise à jour du profil" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, url: urlWithCache })
  } catch {
    return NextResponse.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    )
  }
}
