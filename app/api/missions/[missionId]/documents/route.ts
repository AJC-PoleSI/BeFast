import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { scalewayS3, SCALEWAY_BUCKET } from "@/lib/scaleway/client"

export async function POST(req: NextRequest, { params }: { params: { missionId: string } }) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

    const formData = await req.formData()
    const collaborationId = formData.get("collaborationId") as string
    const file = formData.get("file") as File

    if (!collaborationId || !file) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 })
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9_\-\.]/g, "_")
    const fileName = `collaborations/${params.missionId}/${Math.random().toString(36).substring(7)}_${safeName}`
    const buffer = Buffer.from(await file.arrayBuffer())

    // Objet PRIVÉ (pas d'ACL public-read) : l'accès passe par le endpoint
    // authentifié /api/storage/download qui vérifie l'appartenance à la mission.
    const command = new PutObjectCommand({
      Bucket: SCALEWAY_BUCKET,
      Key: fileName,
      Body: buffer,
      ContentType: file.type,
    })

    await scalewayS3.send(command)

    // On stocke la CLÉ de l'objet (pas une URL publique).
    const { error: dbError } = await supabase.from("mission_documents").insert({
      mission_collaboration_id: collaborationId,
      nom_fichier: file.name,
      file_url: fileName,
      uploaded_by: user.id
    })

    if (dbError) throw new Error(dbError.message)

    return NextResponse.json({ success: true, key: fileName, url: `/api/storage/download?key=${encodeURIComponent(fileName)}` })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
