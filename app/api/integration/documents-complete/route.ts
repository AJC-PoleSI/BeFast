export const dynamic = "force-dynamic"

import "server-only"

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { scalewayS3, SCALEWAY_BUCKET } from "@/lib/scaleway/client"
import { GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { pushDocumentsToRh, type CuratedDocument } from "@/lib/integration/rh-client"

const SIGNED_URL_TTL = 3600 // 1 h

// POST /api/integration/documents-complete
// Le candidat déclare ses documents complets depuis son portail BeFast.
// BeFast génère des URLs signées courtes et POUSSE un payload CURÉ vers RH.
// RH ne lit jamais la base BeFast → isolation.
export async function POST() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const admin = createAdminClient()
  const email = user.email.trim().toLowerCase()

  try {
    const { data: docs } = await admin
      .from("documents_personnes")
      .select("*")
      .eq("personne_id", user.id)

    const documents: CuratedDocument[] = []
    for (const d of docs ?? []) {
      const filePath = (d as Record<string, unknown>).file_path as string
      if (!filePath) continue
      const type = String(
        (d as Record<string, unknown>).doc_type ??
          (d as Record<string, unknown>).type ??
          ""
      )
      const filename = String(
        (d as Record<string, unknown>).file_name ??
          filePath.split("/").pop() ??
          "document"
      )
      const signedUrl = await getSignedUrl(
        scalewayS3,
        new GetObjectCommand({ Bucket: SCALEWAY_BUCKET, Key: filePath }),
        { expiresIn: SIGNED_URL_TTL }
      )
      documents.push({
        type,
        filename,
        signedUrl,
        expiresAt: new Date(Date.now() + SIGNED_URL_TTL * 1000).toISOString(),
      })
    }

    const pushed = await pushDocumentsToRh({ email, documents, complete: true })
    if (!pushed.ok) {
      return NextResponse.json(
        { error: "Push RH échoué.", details: pushed.error },
        { status: 502 }
      )
    }

    // Flags de complétion (masquent le nudge des deux côtés).
    await admin
      .from("personnes")
      .update({ documents_complete: true })
      .eq("id", user.id)
    await admin
      .from("account_links")
      .update({ documents_complete: true })
      .eq("email", email)

    return NextResponse.json({ ok: true, count: documents.length })
  } catch (e) {
    return NextResponse.json(
      { error: "Erreur documents-complete.", details: String(e) },
      { status: 500 }
    )
  }
}
