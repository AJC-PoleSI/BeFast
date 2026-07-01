export const dynamic = "force-dynamic"

import "server-only"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedProfile } from "@/lib/auth/cached-profile"
import { hasPermission } from "@/lib/auth/permissions"
import {

  VALID_DOC_TYPES,
  MAX_FILE_SIZE,
  ACCEPTED_FILE_TYPES,
} from "@/app/(dashboard)/dashboard/profil/_lib/schemas"
import { scalewayS3, SCALEWAY_BUCKET } from "@/lib/scaleway/client"
import { buildPersonneDocPath } from "@/lib/scaleway/paths"
import { PutObjectCommand } from "@aws-sdk/client-s3"
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
      // Vérifie admin OU permission voir_documents_membres (rôle de base ∪ postes).
      const requesterProfile = await getCachedProfile(user.id)
      const canViewMemberDocs = hasPermission(requesterProfile, "voir_documents_membres")

      if (!canViewMemberDocs) {
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
      .order("updated_at", { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: "Erreur lors de la récupération des documents" },
        { status: 500 }
      )
    }

    // Normalize: if status column not yet migrated, default to "pending"
    const normalized = (data ?? []).map((doc: Record<string, unknown>) => ({
      ...doc,
      status: doc.status ?? "pending",
    }))

    return NextResponse.json({ documents: normalized })
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
    const admin = createAdminClient()

    // Récupère le vrai nom/prénom pour la nomenclature Scaleway
    const { data: personne } = await admin
      .from("personnes")
      .select("prenom, nom")
      .eq("id", user.id)
      .single()

    const prenom = personne?.prenom || "Inconnu"
    const nom = personne?.nom || user.id.slice(0, 8)

    const filePath = buildPersonneDocPath(user.id, prenom, nom, docType, ext)

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    try {
      await scalewayS3.send(
        new PutObjectCommand({
          Bucket: SCALEWAY_BUCKET,
          Key: filePath,
          Body: buffer,
          ContentType: file.type,
          Metadata: { "original-name": file.name },
        })
      )
    } catch (uploadErr) {
      console.error("Scaleway upload error:", uploadErr)
      return NextResponse.json(
        { error: "Erreur lors de l'upload du fichier" },
        { status: 500 }
      )
    }

    // Step 1: upsert core fields (works even if migration 007 not yet applied)
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
        },
        { onConflict: "personne_id,type" }
      )
      .select()
      .single()

    if (dbError) {
      console.error("Database error (upsert):", dbError)
      return NextResponse.json(
        { error: `Erreur DB: ${dbError.message}` },
        { status: 500 }
      )
    }

    // Step 2: try to set status = pending (requires migration 007)
    // Fails gracefully if the column doesn't exist yet
    const { data: withStatus } = await admin
      .from("documents_personnes")
      .update({ status: "pending" })
      .eq("id", data.id)
      .select()
      .single()

    return NextResponse.json({ success: true, document: withStatus ?? data })
  } catch {
    return NextResponse.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    )
  }
}
