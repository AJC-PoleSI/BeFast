export const dynamic = "force-dynamic"

import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireApiPermission } from "@/lib/auth/api-guards"
import { NextResponse } from "next/server"


export async function GET() {
  // Contient entre autres le RIB de l'association et les taux de paie —
  // aucune vérification d'autorisation n'existait ici alors que le PATCH
  // juste en dessous en a une (audit sécurité du 2026-09-07).
  const guard = await requireApiPermission("parametres_structure")
  if (!guard.ok) return guard.response

  const { data, error } = await createAdminClient().from("parametres").select("*")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ parametres: data })
}

export async function PATCH(request: Request) {
  const guard = await requireApiPermission("parametres_structure")
  if (!guard.ok) return guard.response

  const admin = createAdminClient()
  const { key, value } = await request.json()
  const { error } = await admin.from("parametres").upsert({ key, value })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
