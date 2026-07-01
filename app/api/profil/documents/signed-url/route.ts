export const dynamic = "force-dynamic"

import "server-only"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedProfile } from "@/lib/auth/cached-profile"
import { hasPermission } from "@/lib/auth/permissions"
import { scalewayS3, SCALEWAY_BUCKET } from "@/lib/scaleway/client"
import { GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { NextResponse } from "next/server"


export async function POST(request: Request) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const body = await request.json()
    const { filePath } = body

    if (!filePath || typeof filePath !== "string") {
      return NextResponse.json(
        { error: "Chemin du fichier requis" },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // Verify ownership or admin role
    const { data: doc } = await admin
      .from("documents_personnes")
      .select("personne_id")
      .eq("file_path", filePath)
      .single()

    if (!doc) {
      return NextResponse.json(
        { error: "Document introuvable" },
        { status: 404 }
      )
    }

    if (doc.personne_id !== user.id) {
      // Vérifie admin OU permission voir_documents_membres (rôle de base ∪ postes).
      const requesterProfile = await getCachedProfile(user.id)
      const canViewMemberDocs = hasPermission(requesterProfile, "voir_documents_membres")

      if (!canViewMemberDocs) {
        return NextResponse.json(
          { error: "Accès non autorisé" },
          { status: 403 }
        )
      }
    }

    const signedUrl = await getSignedUrl(
      scalewayS3,
      new GetObjectCommand({ Bucket: SCALEWAY_BUCKET, Key: filePath }),
      { expiresIn: 3600 } // 1 hour
    )

    return NextResponse.json({ url: signedUrl })
  } catch {
    return NextResponse.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    )
  }
}
