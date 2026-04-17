import "server-only"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  VALID_DOC_TYPES,
  MAX_FILE_SIZE,
  ACCEPTED_FILE_TYPES,
} from "@/app/(dashboard)/dashboard/profil/_lib/schemas"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const url = new URL(request.url)
    const targetUserId = url.searchParams.get("targetUserId")
    let queryId = user.id

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
      queryId = targetUserId
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from("documents_personnes")
      .select("*")
      .eq("personne_id", queryId)
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
    const docType = formData.get("docType") as string | null

    if (!file || !docType) {
      return NextResponse.json(
        { error: "Fichier et type de document requis" },
        { status: 400 }
      )
    }

    if (
      !VALID_DOC_TYPES.includes(
        docType as (typeof VALID_DOC_TYPES)[number]
      )
    ) {
      return NextResponse.json(
        { error: "Type de document invalide" },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Le fichier ne doit pas dépasser 10 Mo" },
        { status: 400 }
      )
    }

    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Type de fichier non accepté (JPEG, PNG, WebP, PDF)" },
        { status: 400 }
      )
    }

    const ext = file.name.split(".").pop() || "pdf"
    const filePath = `${user.id}/${docType}/document.${ext}`

    const admin = createAdminClient()

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await admin.storage
      .from("documents-personnes")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json(
        { error: "Erreur lors de l'upload du fichier" },
        { status: 500 }
      )
    }

    // Upsert document record
    const { data, error: dbError } = await admin
      .from("documents_personnes")
      .upsert(
        {
          personne_id: user.id,
          type: docType,
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          status: "pending",
        },
        { onConflict: "personne_id,type" }
      )
      .select()
      .single()

    if (dbError) {
      return NextResponse.json(
        { error: "Erreur lors de l'enregistrement du document" },
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
