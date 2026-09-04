import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { requireApiAdmin } from "@/lib/auth/api-guards"
import { NextResponse } from "next/server"
import { sendEmail } from "@/lib/email/send"
import { accountValidatedEmail } from "@/lib/email/templates"
import { logAudit } from "@/lib/supabase-security"
import { deleteAccount } from "@/lib/account-deletion/delete-account"

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const body = await request.json()
    const { account_status, rejection_reason } = body

    if (!account_status) {
      return NextResponse.json({ error: "account_status required" }, { status: 400 })
    }

    // Contrôle d'accès : seul un administrateur peut valider / rejeter un compte.
    const guard = await requireApiAdmin()
    if (!guard.ok) return guard.response

    const supabase = createAdminClient()

    // Construit le patch en fonction du statut visé.
    const patch: Record<string, unknown> = { account_status }
    if (account_status === "rejected") {
      patch.rejection_reason = rejection_reason?.trim() || null
      patch.rejected_at = new Date().toISOString()
      patch.rejected_by = guard.userId
    } else {
      // Validation / repassage en attente : on efface toute trace de rejet.
      patch.rejection_reason = null
      patch.rejected_at = null
      patch.rejected_by = null
    }

    const { data, error } = await supabase
      .from("personnes")
      .update(patch)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Notification best-effort : un échec d'email ne doit pas faire échouer la validation.
    if (account_status === "validated" && data?.email) {
      const tpl = accountValidatedEmail(data.prenom ?? null)
      await sendEmail({ to: data.email, subject: tpl.subject, html: tpl.html })
    }

    return NextResponse.json({ success: true, personne: data })
  } catch (e: any) {
    console.error("API error:", e)
    return NextResponse.json({ error: e.message || "Erreur serveur" }, { status: 500 })
  }
}

// DELETE /api/admin/personnes/[id]
// Suppression d'un compte par un administrateur : accès coupé, données
// personnelles purgées, identité anonymisée. La ligne `personnes` est conservée
// pour ne pas emporter l'historique des missions et des frais.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    const guard = await requireApiAdmin()
    if (!guard.ok) return guard.response

    // Un administrateur qui supprimerait son propre compte se verrouillerait
    // dehors, et perdrait au passage le droit de réparer quoi que ce soit.
    if (guard.userId === id) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas supprimer votre propre compte." },
        { status: 400 },
      )
    }

    const result = await deleteAccount(id)

    await logAudit(createClient(), "personnes", "DELETE", id, {
      failedSteps: result.failedSteps,
    })

    if (!result.ok && result.failedSteps.includes("statut")) {
      return NextResponse.json(
        { error: "La suppression a échoué : le compte est inchangé." },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, failedSteps: result.failedSteps })
  } catch (e: any) {
    console.error("[DELETE /api/admin/personnes/:id]", e?.message ?? e)
    return NextResponse.json({ error: e?.message || "Erreur serveur" }, { status: 500 })
  }
}
