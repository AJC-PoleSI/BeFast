import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    // Quick role check - ideally done through RLS or a proper server-side role check
    const { data: profile } = await supabase.from("personnes").select("profils_types(slug)").eq("id", user?.id).single()
    const slug = (profile?.profils_types as any)?.slug
    
    if (slug !== 'tresorerie' && slug !== 'administrateur' && slug !== 'membre_agc') {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
    }

    const { id, action } = await req.json()

    if (!id || !['valider', 'rejeter', 'payer'].includes(action)) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 })
    }

    let statut = 'soumis'
    if (action === 'valider') statut = 'valide'
    if (action === 'rejeter') statut = 'brouillon' // Return to intervenant
    if (action === 'payer') statut = 'paye'

    const { error: dbError } = await supabase.from("notes_de_frais").update({
      statut,
      ...(action === 'valider' ? { validated_at: new Date().toISOString() } : {})
    }).eq("id", id)

    if (dbError) throw new Error(dbError.message)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
