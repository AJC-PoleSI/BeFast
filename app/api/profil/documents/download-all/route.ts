export const dynamic = "force-dynamic"

import "server-only"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedProfile } from "@/lib/auth/cached-profile"
import { hasPermission } from "@/lib/auth/permissions"
import { scalewayS3, SCALEWAY_BUCKET } from "@/lib/scaleway/client"
import { GetObjectCommand } from "@aws-sdk/client-s3"
import { DOC_TYPE_LABELS } from "@/app/(dashboard)/dashboard/profil/_lib/schemas"
import { NextResponse } from "next/server"
import PizZip from "pizzip"

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
        return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
      }
      queryId = targetUserId
    }

    const admin = createAdminClient()
    const [{ data: docs, error: docsError }, { data: personne }] = await Promise.all([
      admin
        .from("documents_personnes")
        .select("*")
        .eq("personne_id", queryId)
        .order("type", { ascending: true }),
      admin.from("personnes").select("prenom, nom").eq("id", queryId).single(),
    ])

    if (docsError) {
      return NextResponse.json(
        { error: "Erreur lors de la récupération des documents" },
        { status: 500 }
      )
    }

    if (!docs || docs.length === 0) {
      return NextResponse.json({ error: "Aucun document à télécharger" }, { status: 404 })
    }

    const zip = new PizZip()
    const usedNames = new Set<string>()

    for (const doc of docs) {
      const { Body } = await scalewayS3.send(
        new GetObjectCommand({ Bucket: SCALEWAY_BUCKET, Key: doc.file_path })
      )
      if (!Body) continue

      const buffer = Buffer.from(await Body.transformToByteArray())

      const ext = doc.file_name.includes(".") ? doc.file_name.split(".").pop() : "pdf"
      const label = DOC_TYPE_LABELS[doc.type] || doc.type
      let entryName = `${label}.${ext}`
      if (usedNames.has(entryName)) {
        entryName = `${label} (${doc.id.slice(0, 8)}).${ext}`
      }
      usedNames.add(entryName)

      zip.file(entryName, buffer)
    }

    const zipBuffer = zip.generate({ type: "nodebuffer" })

    const prenom = personne?.prenom || "membre"
    const nom = personne?.nom || queryId.slice(0, 8)
    const zipName = `Documents_${prenom}_${nom}.zip`.replace(/[^\w\-. ]/g, "_")

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipName}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: "Une erreur est survenue." }, { status: 500 })
  }
}
