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

    const command = new PutObjectCommand({
      Bucket: SCALEWAY_BUCKET,
      Key: fileName,
      Body: buffer,
      ContentType: file.type,
      ACL: 'public-read'
    })

    await scalewayS3.send(command)

    const region = process.env.NEXT_PUBLIC_SCALEWAY_REGION ?? "fr-par"
    const publicUrl = `https://${SCALEWAY_BUCKET}.s3.${region}.scw.cloud/${fileName}`

    // Insert to DB
    const { error: dbError } = await supabase.from("mission_documents").insert({
      mission_collaboration_id: collaborationId,
      nom_fichier: file.name,
      file_url: publicUrl,
      uploaded_by: user.id
    })

    if (dbError) throw new Error(dbError.message)

    return NextResponse.json({ success: true, url: publicUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
