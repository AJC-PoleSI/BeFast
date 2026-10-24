import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { requireApiAdmin, requireApiPermission } from "@/lib/auth/api-guards"
import { NextResponse } from "next/server"
import { sendEmail } from "@/lib/email/send"
import { accountValidatedEmail } from "@/lib/email/templates"
import { logAudit } from "@/lib/supabase-security"
import { deleteAccount } from "@/lib/account-deletion/delete-account"
import { revalidateTag } from "next/cache"
import { USER_PROFILE_TAG } from "@/lib/cache-tags"

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { id } = params
    const body = await request.json()
    const { account_status } = body

    if (!account_status) {
      return NextResponse.json({ error: "account_status required" }, { status: 400 })
    }

    // Plus de rejet de compte : un compte non validé reste « en attente » et ne
    // voit aucune donnée (RLS 082 + restriction applicative). Les rejets
    // faits en bloc sous le compte partagé (sept. 2026) n'étaient pas traçables.
    if (account_status === "rejected") {
      return NextResponse.json(
        { error: "Le rejet de compte n'existe plus : un compte non validé reste en attente." },
        { status: 400 }
      )
    }

    // Contrôle d'accès : permission `valider_comptes` (administrateurs et tout
    // poste à qui elle est accordée, ex. Pôle RH).
    const guard = await requireApiPermission("valider_comptes")
    if (!guard.ok) return guard.response

    const supabase = createAdminClient()

    // Validation / repassage en attente : on efface toute trace de rejet
    // (anciens comptes rejetés, restaurés le 19/10/2026).
    const patch: Record<string, unknown> = {
      account_status,
      rejection_reason: null,
      rejected_at: null,
      rejected_by: null,
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

    // Le statut du compte conditionne ses permissions (compte restreint) et
    // vit dans le profil mis en cache 5 min : on l'invalide tout de suite.
    revalidateTag(USER_PROFILE_TAG(id))

    // Trace : chaque changement de statut est journalisé avec son auteur
    // (un balayage de 160 comptes en sept. 2026 n'avait laissé aucune trace).
    await logAudit(createClient(), "personnes", "UPDATE", id, {
      account_status,
      is_candidate: data?.is_candidate ?? null,
    })

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
export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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

    // Le profil est mis en cache cinq minutes ; sans cette invalidation, la
    // garde du tableau de bord laisserait la session en cours continuer
    // jusqu'à l'expiration du cache.
    revalidateTag(USER_PROFILE_TAG(id))

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
