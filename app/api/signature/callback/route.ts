import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { getRequestStatus, isLiveConsentConfigured } from "@/lib/signature/liveconsent"

export const dynamic = "force-dynamic"

/** Comparaison à temps constant de deux chaînes. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/**
 * Webhook LiveConsent — appelé en GET avec requestId, status (code numérique),
 * recipientEmail, eventDate. Doit répondre "OK" (retries 10× sur 24 h sinon).
 * Pas de signature cryptographique côté LiveConsent : on n'accepte que les
 * requestId déjà connus en base, on re-demande le statut consolidé à l'API
 * LiveConsent (authentifiée) plutôt que de faire confiance au paramètre, et —
 * si `LIVECONSENT_WEBHOOK_SECRET` est défini — on exige un token partagé dans
 * l'URL de callback (empêche l'empoisonnement du journal par un tiers).
 */
export async function GET(request: Request) {
  const url = new URL(request.url)

  // Secret partagé (défense contre les appels forgés). Le token est intégré à
  // l'URL de callback fournie à LiveConsent. Si le secret n'est pas configuré,
  // on conserve le comportement précédent (revalidation via l'API authentifiée).
  const secret = process.env.LIVECONSENT_WEBHOOK_SECRET
  if (secret) {
    const token = url.searchParams.get("token") || ""
    if (!safeEqual(token, secret)) {
      // Réponse neutre : ne révèle pas la raison, stoppe les retries.
      return new NextResponse("OK")
    }
  }

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
