import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const sb = createClient()
  const { data: tpl, error } = await sb
    .from("document_templates")
    .select("file_path, file_name")
    .eq("id", params.id)
    .single()
  if (error || !tpl) return NextResponse.json({ error: "Introuvable" }, { status: 404 })

  const { data: blob, error: dlErr } = await sb.storage.from("templates").download(tpl.file_path)
  if (dlErr || !blob) return NextResponse.json({ error: dlErr?.message || "DL error" }, { status: 500 })

  const buf = Buffer.from(await blob.arrayBuffer())
  return new NextResponse(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${tpl.file_name}"`,
    },
  })
}
