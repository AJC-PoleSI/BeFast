export const dynamic = "force-dynamic"

import "server-only"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  VALID_DOC_TYPES,
  MAX_FILE_SIZE,
  isAcceptedFileType,
  resolveMimeType,
  fileExtension,
} from "@/app/(dashboard)/dashboard/profil/_lib/schemas"
import { getSignedUploadUrl } from "@/lib/scaleway/client"
import { buildPersonneDocPath } from "@/lib/scaleway/paths"
import { NextResponse } from "next/server"

/**
 * POST /api/profil/documents/upload-url
 *
 * Renvoie une URL présignée pour envoyer le fichier directement à Scaleway.
 * Le chemin de destination est calculé ici, à partir de l'utilisateur
 * authentifié : le client ne choisit jamais la clé de l'objet.
 *
 * Le navigateur enchaîne ensuite sur POST /api/profil/documents (corps JSON)
 * qui enregistre la ligne en base une fois l'objet déposé.
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

    const body = await request.json().catch(() => null)
    const docType = typeof body?.docType === "string" ? body.docType : null
    const fileName = typeof body?.fileName === "string" ? body.fileName : null
    const fileType = typeof body?.fileType === "string" ? body.fileType : ""
    const fileSize = Number(body?.fileSize)

    if (!docType || !fileName) {
      return NextResponse.json(
        { error: "Fichier et type de document requis" },
        { status: 400 }
      )
    }

    if (!VALID_DOC_TYPES.includes(docType as (typeof VALID_DOC_TYPES)[number])) {
      return NextResponse.json({ error: "Type de document invalide" }, { status: 400 })
    }

    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Le fichier ne doit pas dépasser 10 Mo" },
        { status: 400 }
      )
    }

    const descriptor = { name: fileName, type: fileType }
    if (!isAcceptedFileType(descriptor)) {
      return NextResponse.json(
        { error: "Type de fichier non accepté (JPEG, PNG, WebP, HEIC, PDF)" },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const { data: personne } = await admin
      .from("personnes")
      .select("prenom, nom")
      .eq("id", user.id)
      .single()

    const mimeType = resolveMimeType(descriptor)
    const filePath = buildPersonneDocPath(
      user.id,
      personne?.prenom || "Inconnu",
      personne?.nom || user.id.slice(0, 8),
      docType,
      fileExtension(descriptor)
    )

    const uploadUrl = await getSignedUploadUrl(filePath, mimeType)

    return NextResponse.json({ uploadUrl, filePath, mimeType })
  } catch {
    return NextResponse.json({ error: "Une erreur est survenue." }, { status: 500 })
  }
}
