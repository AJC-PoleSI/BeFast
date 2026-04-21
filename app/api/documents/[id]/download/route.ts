import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const sb = createClient()
  const { data: doc, error } = await sb
    .from("generated_documents")
    .select("file_path, file_name")
    .eq("id", params.id)
    .single()
  if (error || !doc) return NextResponse.json({ error: "Introuvable" }, { status: 404 })

  const { data: blob, error: dlErr } = await sb.storage.from("documents").download(doc.file_path)
  if (dlErr || !blob) return NextResponse.json({ error: "DL" }, { status: 500 })

  const buf = Buffer.from(await blob.arrayBuffer())
  return new NextResponse(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${doc.file_name}"`,
    },
  })
}
