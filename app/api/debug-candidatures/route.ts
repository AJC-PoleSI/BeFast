import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data: candidatures, error } = await supabase
    .from("candidatures")
    .select("*, personnes(id, prenom, nom)")
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ count: candidatures.length, candidatures })
}
