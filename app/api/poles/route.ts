import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Direct admin client — no cookies, no RLS, no server action weirdness
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET() {
  const sb = adminClient()
  const { data, error } = await sb
    .from("parametres")
    .select("key, value")
    .in("key", ["poles_liste", "pole_permissions"])

  if (error) {
    console.error("[API/POLES] GET error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const result: Record<string, any> = {}
  for (const row of data || []) {
    try {
      result[row.key] = JSON.parse(row.value)
    } catch {
      result[row.key] = row.value
    }
  }

  return NextResponse.json({ data: result })
}

export async function POST(req: NextRequest) {
  const sb = adminClient()
  const body = await req.json()
  const { poles_liste, pole_permissions } = body

  console.log("[API/POLES] Saving:", JSON.stringify(poles_liste).slice(0, 200))

  const rows = [
    { key: "poles_liste", value: JSON.stringify(poles_liste) },
    { key: "pole_permissions", value: JSON.stringify(pole_permissions) },
  ]

  const { error } = await sb
    .from("parametres")
    .upsert(rows, { onConflict: "key" })

  if (error) {
    console.error("[API/POLES] POST error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Verify the write by reading back
  const { data: verify } = await sb
    .from("parametres")
    .select("key, value")
    .eq("key", "poles_liste")
    .single()

  console.log("[API/POLES] Verified write:", verify?.value?.slice(0, 200))

  return NextResponse.json({ success: true })
}
