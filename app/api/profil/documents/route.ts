export const dynamic = "force-dynamic"

import "server-only"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedProfile } from "@/lib/auth/cached-profile"
import { hasPermission } from "@/lib/auth/permissions"
import {
  VALID_DOC_TYPES,
  MAX_FILE_SIZE,
  isAcceptedFileType,
  resolveMimeType,
  fileExtension,
} from "@/app/(dashboard)/dashboard/profil/_lib/schemas"
import { scalewayS3, SCALEWAY_BUCKET } from "@/lib/scaleway/client"
import { buildPersonneDocPath } from "@/lib/scaleway/paths"
import {
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3"
import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"

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

/** Chemin Scaleway d'un justificatif, calculé côté serveur uniquement. */
async function resolveFilePath(
  admin: SupabaseClient,
  userId: string,
  docType: string,
  descriptor: { name: string; type: string }
): Promise<string> {
  const { data: personne } = await admin
    .from("personnes")
    .select("prenom, nom")
    .eq("id", userId)
    .single()

  return buildPersonneDocPath(
    userId,
    personne?.prenom || "Inconnu",
    personne?.nom || userId.slice(0, 8),
    docType,
    fileExtension(descriptor)
  )
}

/**
 * Enregistre (ou remplace) la ligne documents_personnes et repasse le
 * justificatif « en attente de validation ».
 */
async function saveDocumentRow(
  admin: SupabaseClient,
  row: {
    personne_id: string
    type: string
    file_path: string
    file_name: string
    file_size: number
    mime_type: string
  }
) {
  // L'ancien fichier n'est pas écrasé quand l'extension change (un PDF
  // remplacé par une photo) : sans ce nettoyage il restait indéfiniment dans
  // le bucket, invisible de l'application.
  const { data: previous } = await admin
    .from("documents_personnes")
    .select("file_path")
    .eq("personne_id", row.personne_id)
    .eq("type", row.type)
    .maybeSingle()

  const { data, error } = await admin
    .from("documents_personnes")
    .upsert(row, { onConflict: "personne_id,type" })
    .select()
    .single()

  if (error || !data) return { error }

  const previousPath = (previous as { file_path?: string } | null)?.file_path
  if (previousPath && previousPath !== row.file_path) {
    try {
      await scalewayS3.send(
        new DeleteObjectCommand({ Bucket: SCALEWAY_BUCKET, Key: previousPath })
      )
    } catch (err) {
      console.error("Scaleway cleanup error:", err)
    }
  }

  // Un justificatif remplacé doit repasser en attente même s'il avait été
  // validé ou refusé (colonne ajoutée par la migration 007 : on ignore
  // silencieusement l'échec si elle n'existe pas encore).
  const { data: withStatus } = await admin
    .from("documents_personnes")
    .update({ status: "pending", updated_at: new Date().toISOString() })
    .eq("id", data.id)
    .select()
    .single()

  return { document: withStatus ?? data }
}

/**
 * POST /api/profil/documents
 *
 * Deux formes :
 *  - `application/json` : confirme un fichier déjà déposé sur Scaleway via
 *    l'URL présignée de /api/profil/documents/upload-url. C'est le chemin
 *    normal, le seul qui fonctionne au-delà de ~4,5 Mo (limite de corps de
 *    requête des fonctions Vercel).
 *  - `multipart/form-data` : envoi du fichier à travers la route. Conservé
 *    comme repli pour les petits fichiers si l'upload direct échoue.
 */
export async function POST(request: Request) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const admin = createAdminClient()
    const contentType = request.headers.get("content-type") || ""

    /* ── Confirmation d'un upload direct ──────────────────────────────── */
    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => null)
      const docType = typeof body?.docType === "string" ? body.docType : null
      const fileName = typeof body?.fileName === "string" ? body.fileName : null
      const fileType = typeof body?.fileType === "string" ? body.fileType : ""

      if (!docType || !fileName) {
        return NextResponse.json(
          { error: "Fichier et type de document requis" },
          { status: 400 }
        )
      }

      if (!VALID_DOC_TYPES.includes(docType as (typeof VALID_DOC_TYPES)[number])) {
        return NextResponse.json({ error: "Type de document invalide" }, { status: 400 })
      }

      const descriptor = { name: fileName, type: fileType }
      if (!isAcceptedFileType(descriptor)) {
        return NextResponse.json(
          { error: "Type de fichier non accepté (JPEG, PNG, WebP, HEIC, PDF)" },
          { status: 400 }
        )
      }

      const filePath = await resolveFilePath(admin, user.id, docType, descriptor)

      // La taille et l'existence viennent de Scaleway, pas du client.
      let head
      try {
        head = await scalewayS3.send(
          new HeadObjectCommand({ Bucket: SCALEWAY_BUCKET, Key: filePath })
        )
      } catch {
        return NextResponse.json(
          { error: "Fichier introuvable sur le stockage — relancez l'envoi." },
          { status: 400 }
        )
      }

      const fileSize = head.ContentLength ?? 0
      if (fileSize > MAX_FILE_SIZE) {
        try {
          await scalewayS3.send(
            new DeleteObjectCommand({ Bucket: SCALEWAY_BUCKET, Key: filePath })
          )
        } catch {}
        return NextResponse.json(
          { error: "Le fichier ne doit pas dépasser 10 Mo" },
          { status: 400 }
        )
      }

      const saved = await saveDocumentRow(admin, {
        personne_id: user.id,
        type: docType,
        file_path: filePath,
        file_name: fileName,
        file_size: fileSize,
        mime_type: head.ContentType || resolveMimeType(descriptor),
      })

      if (saved.error || !saved.document) {
        console.error("Database error (upsert):", saved.error)
        return NextResponse.json(
          { error: `Erreur DB: ${saved.error?.message ?? "inconnue"}` },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true, document: saved.document })
    }

    /* ── Repli : le fichier transite par la route ─────────────────────── */
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const docType = formData.get("docType") as string | null

    if (!file || !docType) {
      return NextResponse.json(
        { error: "Fichier et type de document requis" },
        { status: 400 }
      )
    }

    if (!VALID_DOC_TYPES.includes(docType as (typeof VALID_DOC_TYPES)[number])) {
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

    if (!isAcceptedFileType(file)) {
      return NextResponse.json(
        { error: "Type de fichier non accepté (JPEG, PNG, WebP, HEIC, PDF)" },
        { status: 400 }
      )
    }

    const filePath = await resolveFilePath(admin, user.id, docType, file)
    const buffer = Buffer.from(await file.arrayBuffer())
    const mimeType = resolveMimeType(file)

    try {
      await scalewayS3.send(
        new PutObjectCommand({
          Bucket: SCALEWAY_BUCKET,
          Key: filePath,
          Body: buffer,
          ContentType: mimeType,
          // Les en-têtes S3 (x-amz-meta-*) doivent être US-ASCII : un nom de
          // fichier avec accents/apostrophe typographique/emoji (courant pour
          // "carte d'identité.pdf" exporté depuis macOS) fait planter l'appel
          // SDK avec une erreur "Invalid character in header content" sinon.
          Metadata: { "original-name": encodeURIComponent(file.name) },
        })
      )
    } catch (uploadErr) {
      console.error("Scaleway upload error:", uploadErr)
      return NextResponse.json(
        { error: "Erreur lors de l'upload du fichier" },
        { status: 500 }
      )
    }

    const saved = await saveDocumentRow(admin, {
      personne_id: user.id,
      type: docType,
      file_path: filePath,
      file_name: file.name,
      file_size: file.size,
      mime_type: mimeType,
    })

    if (saved.error || !saved.document) {
      console.error("Database error (upsert):", saved.error)
      return NextResponse.json(
        { error: `Erreur DB: ${saved.error?.message ?? "inconnue"}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, document: saved.document })
  } catch {
    return NextResponse.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    )
  }
}
