export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedProfile } from "@/lib/auth/cached-profile"
import { canAccessEntityDocuments } from "@/lib/auth/document-access"


export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const admin = createAdminClient()
  const { data: doc, error } = await admin
    .from("generated_documents")
    .select("file_path, file_name, scope, entity_id")
    .eq("id", params.id)
    .single()
  if (error || !doc) return NextResponse.json({ error: "Introuvable" }, { status: 404 })

  const profile = await getCachedProfile(user.id)
  if (!(await canAccessEntityDocuments(profile, doc.scope, doc.entity_id))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
  }

  const { data: blob, error: dlErr } = await admin.storage.from("documents").download(doc.file_path)
  if (dlErr || !blob) return NextResponse.json({ error: "DL" }, { status: 500 })

  const buf = Buffer.from(await blob.arrayBuffer())
  return new NextResponse(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `inline; filename="${doc.file_name}"`,
      // Document sensible : cache privé uniquement (jamais sur un CDN/proxy partagé).
      "Cache-Control": "private, max-age=3600",
    },
  })
}
