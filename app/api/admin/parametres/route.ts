import "server-only"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = createClient()
  const { data, error } = await supabase.from("parametres").select("*")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ parametres: data })
}

export async function PATCH(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const admin = createAdminClient()
  const { data: p } = await admin.from("personnes").select("profils_types(slug)").eq("id", user.id).single()
  if ((p?.profils_types as any)?.slug !== "administrateur")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 })

  const { key, value } = await request.json()
  const { error } = await admin.from("parametres").upsert({ key, value })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
