"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  createSignatureRequest,
  getRequestStatus,
  isLiveConsentConfigured,
} from "@/lib/signature/liveconsent"
import { sendEmail } from "@/lib/email/send"
import { documentToSignEmail } from "@/lib/email/templates"

const MAX_PDF_BYTES = 7 * 1024 * 1024 // garde sous la limite du body des server actions

export type SignatureRequestRow = {
  id: string
  lc_request_id: string
  request_name: string
  document_filename: string
  recipient_firstname: string | null
  recipient_lastname: string | null
  recipient_email: string
  status: string
  last_event_at: string | null
  created_at: string
}

export async function getSignatureConfig() {
  return { configured: isLiveConsentConfigured() }
}

export async function listSignatureRequests(): Promise<
  { data: SignatureRequestRow[] } | { error: string }
> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { data, error } = await supabase
    .from("signature_requests")
    .select(
      "id, lc_request_id, request_name, document_filename, recipient_firstname, recipient_lastname, recipient_email, status, last_event_at, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(100)
  if (error) return { error: error.message }
  return { data: (data ?? []) as SignatureRequestRow[] }
}

export async function sendDocumentForSignature(formData: FormData) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  if (!isLiveConsentConfigured()) {
    return {
      error:
        "LiveConsent n'est pas configuré : renseignez LIVECONSENT_USERNAME / LIVECONSENT_DEVELOPER_KEY / LIVECONSENT_SECRET_KEY dans les variables d'environnement.",
    }
  }

  const file = formData.get("file") as File | null
  const requestName = String(formData.get("requestName") ?? "").trim()
  const message = String(formData.get("message") ?? "").trim()
  const firstname = String(formData.get("firstname") ?? "").trim()
  const lastname = String(formData.get("lastname") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim()
  const phone = String(formData.get("phone") ?? "").trim()

  if (!file || file.size === 0) return { error: "Aucun fichier fourni." }
  if (!file.name.toLowerCase().endsWith(".pdf"))
    return { error: "Seuls les PDF peuvent être envoyés en signature." }
  if (file.size > MAX_PDF_BYTES)
    return { error: "PDF trop volumineux (max 7 Mo)." }
  if (!requestName || !firstname || !lastname || !email || !phone)
    return { error: "Tous les champs signataire sont obligatoires (téléphone inclus : requis par LiveConsent)." }

  const pdfBase64 = Buffer.from(await file.arrayBuffer()).toString("base64")
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")
  const callbackUrl = siteUrl.startsWith("https://")
    ? `${siteUrl}/api/signature/callback`
    : undefined // LiveConsent exige une URL HTTPS — pas de callback en localhost

  try {
    const { requestId } = await createSignatureRequest({
      requestName,
      message: message || undefined,
      pdfBase64,
      filename: file.name,
      recipient: { firstname, lastname, email, phone },
      callbackUrl,
    })

    const admin = createAdminClient()
    const { error: dbErr } = await admin.from("signature_requests").insert({
      lc_request_id: requestId,
      request_name: requestName,
      document_filename: file.name,
      recipient_firstname: firstname,
      recipient_lastname: lastname,
      recipient_email: email,
      status: "envoyee",
      created_by: user.id,
    })
    if (dbErr) console.error("[signature] insert failed:", dbErr.message)

    // Notification best-effort (LiveConsent envoie aussi son propre email).
    const tpl = documentToSignEmail({
      recipientName: `${firstname} ${lastname}`.trim() || null,
      documentName: file.name,
      requestName,
    })
    await sendEmail({ to: email, subject: tpl.subject, html: tpl.html })

    revalidatePath("/signatures")
    return { success: true, requestId }
  } catch (e: any) {
    console.error("[signature] send failed:", e?.message ?? e)
    return { error: e?.message ?? "Échec de l'envoi à LiveConsent." }
  }
}

/** Re-synchronise le statut d'une demande depuis LiveConsent (bouton Actualiser). */
export async function refreshSignatureStatus(id: string) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }
  if (!isLiveConsentConfigured()) return { error: "LiveConsent non configuré." }

  const { data: row } = await supabase
    .from("signature_requests")
    .select("lc_request_id")
    .eq("id", id)
    .single()
  if (!row) return { error: "Demande introuvable." }

  const status = await getRequestStatus(row.lc_request_id)
  if (status === null) return { error: "Statut indisponible côté LiveConsent." }

  const admin = createAdminClient()
  await admin
    .from("signature_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)

  revalidatePath("/signatures")
  return { success: true, status }
}
