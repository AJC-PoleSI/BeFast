import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest, { params }: { params: { type: string, id: string } }) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const { type, id } = params
    const format = req.nextUrl.searchParams.get("format") || "pdf"

    // Example logic for download optimization
    // In a real scenario, this would fetch from Scaleway S3 or generate on the fly and cache it.
    
    // For demonstration, let's assume we fetch a pre-generated file URL from DB
    // e.g., if type === "notes-de-frais"
    
    let fileUrl = ""

    if (type === "notes-de-frais") {
      const { data: note } = await supabase.from("notes_de_frais").select("fichiers_justificatifs").eq("id", id).single()
      if (note && note.fichiers_justificatifs && note.fichiers_justificatifs.length > 0) {
        fileUrl = note.fichiers_justificatifs[0] // just getting the first one as an example
      }
    }

    if (!fileUrl) {
      return NextResponse.json({ error: "Document introuvable" }, { status: 404 })
    }

    // Redirect to the direct file URL so the browser opens it in a new tab instantly
    return NextResponse.redirect(fileUrl)

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
