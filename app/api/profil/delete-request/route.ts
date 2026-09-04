export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiUser } from "@/lib/auth/api-guards"
import { sendEmail } from "@/lib/email/send"
import { accountDeletionRequestEmail } from "@/lib/email/templates"
import { isDuplicateRequest, DELETION_TICKET_TYPE } from "@/lib/account-deletion/request"

// Destinataire des notifications d'administration. Surchargeable par
// environnement pour ne pas polluer la boîte réelle en préproduction.
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL ?? "systeme.info@ajc-mail.com"
const MOTIF_MAX = 1000

// POST /api/profil/delete-request
// L'utilisateur demande la suppression de SON compte. Rien n'est supprimé ici :
// on trace la demande dans support_tickets et on prévient l'administration.
export async function POST(request: Request) {
  try {
    const guard = await requireApiUser()
    if (!guard.ok) return guard.response

    const body = await request.json().catch(() => ({}))
    const motif =
      typeof body?.motif === "string" ? body.motif.trim().slice(0, MOTIF_MAX) : ""

    const supabase = createClient()

    // Anti-doublon : la politique RLS « user read own support_tickets » limite
    // déjà la lecture aux tickets de l'appelant.
    const { data: previous } = await supabase
      .from("support_tickets")
      .select("created_at")
      .eq("utilisateur_id", guard.userId)
      .eq("type_probleme", DELETION_TICKET_TYPE)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (isDuplicateRequest(previous?.created_at)) {
      // Réponse identique au cas nominal : inutile de signaler à l'utilisateur
      // qu'il a déjà demandé, sa demande est bien prise en compte.
      return NextResponse.json({ ok: true, alreadyRequested: true })
    }

    const { profile } = guard
    const { error: ticketError } = await supabase.from("support_tickets").insert({
      utilisateur_id: guard.userId,
      email: profile.email,
      type_probleme: DELETION_TICKET_TYPE,
      description: motif || "Demande de suppression de compte, sans motif précisé.",
      page_url: "/dashboard/profil",
    })

    if (ticketError) {
      console.error("[delete-request] ticket non enregistré", ticketError)
      return NextResponse.json(
        { error: "Impossible d'enregistrer la demande." },
        { status: 500 },
      )
    }

    // Envoi best-effort : le ticket suffit à traiter la demande si l'email échoue.
    const tpl = accountDeletionRequestEmail({
      prenom: profile.prenom,
      nom: profile.nom,
      email: profile.email,
      personneId: guard.userId,
      motif: motif || null,
    })
    const sent = await sendEmail({ to: ADMIN_EMAIL, subject: tpl.subject, html: tpl.html })
    if (!sent.ok) console.error("[delete-request] email non envoyé", sent.error)

    return NextResponse.json({ ok: true, emailSent: sent.ok })
  } catch (e: any) {
    console.error("[delete-request]", e?.message ?? e)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
