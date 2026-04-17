import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const body = await request.json()
    const { account_status } = body
    
    if (!account_status) {
      return NextResponse.json({ error: "account_status required" }, { status: 400 })
    }
    
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("personnes")
      .update({ account_status })
      .eq("id", id)
      .select()
      .single()
      
    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, personne: data })
  } catch (e: any) {
    console.error("API error:", e)
    return NextResponse.json({ error: e.message || "Erreur serveur" }, { status: 500 })
  }
}
