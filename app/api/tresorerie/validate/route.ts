import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logAudit } from "@/lib/supabase-security"
import { requireApiPermission } from "@/lib/auth/api-guards"

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()

    // Accès trésorerie : permission `voir_factures` (admin + poste trésorier·ère /
    // présidente), poste-aware — pas un rôle de base codé en dur.
    const guard = await requireApiPermission("voir_factures")
    if (!guard.ok) return guard.response

    const { id, action } = await req.json()

    if (!id || !['valider', 'rejeter', 'payer'].includes(action)) {
      return NextResponse.json({ error: "Données invalides: id et action requises" }, { status: 400 })
    }

    // Validate that the note exists before updating
    const { data: note } = await supabase
      .from("notes_de_frais")
      .select("id, statut, created_by_id")
      .eq("id", id)
      .single()

    if (!note) {
      return NextResponse.json({ error: "Note de frais not found" }, { status: 404 })
    }

    let statut = 'soumis'
    if (action === 'valider') statut = 'valide'
    if (action === 'rejeter') statut = 'brouillon'
    if (action === 'payer') statut = 'paye'

    const { error: dbError } = await supabase
      .from("notes_de_frais")
      .update({
        statut,
        ...(action === 'valider' ? { validated_at: new Date().toISOString() } : {})
      })
      .eq("id", id)

    if (dbError) {
      console.error('Tresorerie update error:', dbError)
      throw new Error(dbError.message)
    }

    // Log sensitive financial operation
    await logAudit(supabase, 'notes_de_frais', 'UPDATE', id, {
      action,
      new_statut: statut,
      old_statut: note.statut
    })

    return NextResponse.json({ success: true, statut })
  } catch (err: any) {
    console.error('[POST /api/tresorerie/validate]', err.message)
    return NextResponse.json(
      { error: err.message || 'Failed to validate expense' },
      { status: err.status || 500 }
    )
  }
}
