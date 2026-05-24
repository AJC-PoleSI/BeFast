import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { scalewayS3, SCALEWAY_BUCKET } from "@/lib/scaleway/client"

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const formData = await req.formData()
    const missionId = formData.get("missionId") as string
    const montant = parseFloat(formData.get("montant") as string)
    const description = formData.get("description") as string
    const files = formData.getAll("files") as File[]

    if (!missionId || isNaN(montant) || files.length === 0) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 })
    }

    const fileUrls: string[] = []

    for (const file of files) {
      const fileExt = file.name.split('.').pop()
      const safeName = file.name.replace(/[^a-zA-Z0-9_\-\.]/g, "_")
      const fileName = `notes_de_frais/${missionId}/${user.id}/${Math.random().toString(36).substring(7)}_${safeName}`

      const buffer = Buffer.from(await file.arrayBuffer())

      const command = new PutObjectCommand({
        Bucket: SCALEWAY_BUCKET,
        Key: fileName,
        Body: buffer,
        ContentType: file.type,
        // Make sure it's public readable if needed, or rely on signed URLs later
        ACL: 'public-read'
      })

      await scalewayS3.send(command)

      // The URL for Scaleway S3 bucket object (public)
      const region = process.env.NEXT_PUBLIC_SCALEWAY_REGION ?? "fr-par"
      const publicUrl = `https://${SCALEWAY_BUCKET}.s3.${region}.scw.cloud/${fileName}`
      fileUrls.push(publicUrl)
    }

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
    } else {
      await supabase.from("notes_de_frais").insert({
        intervenant_id: user.id,
        mission_id: missionId,
        montant_total: montant,
        description,
        fichiers_justificatifs: fileUrls,
        statut: 'soumis',
        submitted_at: new Date().toISOString()
      })
    }

    // TODO: Email notification to treasury (trésorerie)
    console.log(`[Email Mock] Notification de note de frais soumise pour mission ${missionId} de montant ${montant}€`)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("API Frais Error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
