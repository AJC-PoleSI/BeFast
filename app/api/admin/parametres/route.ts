export const dynamic = "force-dynamic"

import "server-only"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireApiAdmin } from "@/lib/auth/api-guards"
import { NextResponse } from "next/server"


export async function GET() {
  const supabase = createClient()
  const { data, error } = await supabase.from("parametres").select("*")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ parametres: data })
}

export async function PATCH(request: Request) {
  const guard = await requireApiAdmin()
  if (!guard.ok) return guard.response

  const admin = createAdminClient()
  const { key, value } = await request.json()
  const { error } = await admin.from("parametres").upsert({ key, value })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
