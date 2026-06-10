import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUserProfile, logAudit } from "@/lib/supabase-security"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { scalewayS3, SCALEWAY_BUCKET } from "@/lib/scaleway/client"

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { user } = await getCurrentUserProfile(supabase)

    const formData = await req.formData()
    const missionId = formData.get("missionId") as string
    const montant = parseFloat(formData.get("montant") as string)
    const description = formData.get("description") as string
    const files = formData.getAll("files") as File[]

    if (!missionId || isNaN(montant) || files.length === 0) {
      return NextResponse.json(
        { error: "Données invalides: missionId, montant, et files requises" },
        { status: 400 }
      )
    }

    // Verify user is actually an intervenant on this mission
    const { data: missionRole } = await supabase
      .from("mission_intervenants")
      .select("mission_id")
      .eq("mission_id", missionId)
      .eq("personne_id", user.id)
      .single()

    if (!missionRole) {
      return NextResponse.json(
        { error: "Unauthorized: you are not an intervenant on this mission" },
        { status: 403 }
      )
    }

    // Upload des justificatifs en parallèle (au lieu d'un await séquentiel par
    // fichier). Le nom utilise un UUID cryptographique : avec un bucket en
    // public-read, un suffixe court (~5 caractères) serait énumérable.
    const region = process.env.NEXT_PUBLIC_SCALEWAY_REGION ?? "fr-par"
    const fileUrls = await Promise.all(
      files.map(async (file) => {
        const safeName = file.name.replace(/[^a-zA-Z0-9_\-\.]/g, "_")
        const fileName = `notes_de_frais/${missionId}/${user.id}/${randomUUID()}_${safeName}`
        const buffer = Buffer.from(await file.arrayBuffer())

        await scalewayS3.send(
          new PutObjectCommand({
            Bucket: SCALEWAY_BUCKET,
            Key: fileName,
            Body: buffer,
            ContentType: file.type,
            ACL: 'public-read',
          })
        )

        return `https://${SCALEWAY_BUCKET}.s3.${region}.scw.cloud/${fileName}`
      })
    )

    // Check existing note de frais
    const { data: existing } = await supabase.from("notes_de_frais")
      .select("id")
      .eq("intervenant_id", user.id)
      .eq("mission_id", missionId)
      .maybeSingle()

    if (existing) {
      await supabase.from("notes_de_frais").update({
        montant_total: montant,
        description,
        fichiers_justificatifs: fileUrls,
        statut: 'soumis',
        submitted_at: new Date().toISOString()
      }).eq("id", existing.id)

      await logAudit(supabase, 'notes_de_frais', 'UPDATE', existing.id, {
        montant,
        description,
        file_count: files.length
      })
    } else {
      // INSERT ... RETURNING id en un seul appel (évite un SELECT de relecture).
      const { data: newNote } = await supabase.from("notes_de_frais").insert({
        intervenant_id: user.id,
        mission_id: missionId,
        montant_total: montant,
        description,
        fichiers_justificatifs: fileUrls,
        statut: 'soumis',
        submitted_at: new Date().toISOString()
      }).select("id").single()

      if (newNote) {
        await logAudit(supabase, 'notes_de_frais', 'INSERT', newNote.id, {
          montant,
          description,
          file_count: files.length
        })
      }
    }

    // TODO: Email notification to treasury (trésorerie)
    console.log(`[Email Mock] Note de frais soumise pour mission ${missionId} de montant ${montant}€`)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[POST /api/upload/frais]", err.message)
    return NextResponse.json(
      { error: err.message || 'Failed to submit expense' },
      { status: err.status || 500 }
    )
  }
}
