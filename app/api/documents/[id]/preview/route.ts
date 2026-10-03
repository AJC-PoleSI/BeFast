export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedProfile } from "@/lib/auth/cached-profile"
import { canAccessEntityDocuments } from "@/lib/auth/document-access"
import {
  contentDisposition,
  documentDownloadName,
  documentMimeType,
} from "@/lib/documents/download-name"


export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const admin = createAdminClient()
  const { data: doc, error } = await admin
    .from("generated_documents")
    .select(
      "file_path, file_name, scope, entity_id, intervenant:personnes!generated_documents_intervenant_id_fkey(prenom, nom)"
    )
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
      "Content-Type": documentMimeType(doc.file_name),
      // Nom du fichier téléchargé : référence + étudiant concerné
      // (« 26 RDM03 20 - Felix Pitz.docx »), en-tête sûr pour les accents.
      "Content-Disposition": contentDisposition(
        "inline",
        documentDownloadName(doc.file_name, firstOrSelf(doc.intervenant))
      ),
      // Document sensible : cache privé uniquement (jamais sur un CDN/proxy partagé).
      "Cache-Control": "private, max-age=3600",
    },
  })
}

/** Une relation many-to-one PostgREST peut être typée tableau ou objet. */
function firstOrSelf<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
}
