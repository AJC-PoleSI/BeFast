import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getRequestStatus, isLiveConsentConfigured } from "@/lib/signature/liveconsent"

export const dynamic = "force-dynamic"

/**
 * Webhook LiveConsent — appelé en GET avec requestId, status (code numérique),
 * recipientEmail, eventDate. Doit répondre "OK" (retries 10× sur 24 h sinon).
 * Pas de signature cryptographique côté LiveConsent : on n'accepte que les
 * requestId déjà connus en base, et on re-demande le statut consolidé à l'API
 * LiveConsent (authentifiée) plutôt que de faire confiance au paramètre.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const requestId = url.searchParams.get("requestId")
  const code = url.searchParams.get("status")
  const recipientEmail = url.searchParams.get("recipientEmail")
  const eventDate = url.searchParams.get("eventDate")

  if (!requestId) return new NextResponse("OK")

  const admin = createAdminClient()
  const { data: row } = await admin
    .from("signature_requests")
    .select("id, events, category")
    .eq("lc_request_id", requestId)
    .single()

  // requestId inconnu : on ignore silencieusement (mais on répond OK pour
  // stopper les retries LiveConsent).
  if (!row) return new NextResponse("OK")

  const event = {
    code: code ? Number(code) : null,
    recipient: recipientEmail,
    at: eventDate ?? new Date().toISOString(),
  }

  // Statut consolidé re-demandé à l'API (source de vérité authentifiée).
  let status: string | null = null
  if (isLiveConsentConfigured()) {
    status = await getRequestStatus(requestId).catch(() => null)
  }

  // Archivage automatique d'un BA dès qu'il est signé/complété.
  const SIGNED = ["signed", "completed", "signe", "termine"]
  const isSigned = status != null && SIGNED.includes(status.toLowerCase())

  await admin
    .from("signature_requests")
    .update({
      ...(status ? { status } : {}),
      ...(isSigned ? { archived: true } : {}),
      last_event_code: event.code,
      last_event_at: event.at,
      events: [...(Array.isArray(row.events) ? row.events : []), event],
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)

  return new NextResponse("OK")
}
