export const dynamic = "force-dynamic"

import "server-only"

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireApiAdmin } from "@/lib/auth/api-guards"


export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireApiAdmin()
    if (!guard.ok) return guard.response

    const body = await request.json()
    const { status } = body

    if (!["approved", "rejected", "pending"].includes(status)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 })
    }

    const admin = createAdminClient()
    const documentId = params.id

    const { data, error } = await admin
      .from("documents_personnes")
      .update({ status })
      .eq("id", documentId)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: "Erreur lors de la mise à jour du document" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, document: data })
  } catch {
    return NextResponse.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    )
  }
}
