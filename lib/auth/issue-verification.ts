import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  VERIFICATION_TTL_MS,
  generateVerificationToken,
  verificationEmailHtml,
} from "./verification"
import { sendEmail } from "@/lib/email/send"
import { ONBOARDING_BASE_URL } from "@/lib/integration/token"

export const VERIFICATION_SUBJECT = "Vérifiez votre adresse email — BeFast"

/**
 * Un renvoi ne doit pas invalider un lien qui vient d'être émis : sans ce
 * garde-fou, deux clics sur « renvoyer » (ou un double POST) se marchent
 * dessus et le lien reçu en premier ne fonctionne plus.
 */
export const RESEND_COOLDOWN_MS = 60 * 1000

export type IssueResult =
  | { ok: true; status: "sent" | "throttled" }
  | { ok: false; status: "db_error" | "email_error"; error: string }

/** Le token en base est-il assez frais pour qu'un renvoi soit inutile ? */
export function issuedWithinCooldown(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false
  const issuedAt = new Date(expiresAt).getTime() - VERIFICATION_TTL_MS
  return Number.isFinite(issuedAt) && Date.now() - issuedAt < RESEND_COOLDOWN_MS
}

/**
 * Émet un token de vérification, le persiste, puis envoie l'email.
 *
 * Historique (incident du 13/09/2026) : les deux `await` étaient tirés sans
 * lire leur retour. Un update refusé ou un envoi en échec passait pour un
 * succès — l'appelant répondait 200 « pending » alors que ni la base ni la
 * boîte mail n'avaient bougé, et le candidat restait bloqué sans que
 * personne ne le sache. Toute erreur remonte désormais à l'appelant.
 */
export async function issueAndSendVerification(
  admin: SupabaseClient,
  person: { id: string; email: string; prenom?: string | null },
): Promise<IssueResult> {
  const { token, tokenHash, expiresAt } = generateVerificationToken()

  const { error: updateError } = await admin
    .from("personnes")
    .update({
      verification_token_hash: tokenHash,
      verification_token_expires_at: expiresAt,
      email_verified: false,
    })
    .eq("id", person.id)

  if (updateError) {
    console.error("[verification] persist token failed", {
      personId: person.id,
      message: updateError.message,
    })
    return { ok: false, status: "db_error", error: updateError.message }
  }

  const sent = await sendEmail({
    to: person.email,
    subject: VERIFICATION_SUBJECT,
    html: verificationEmailHtml({
      prenom: person.prenom ?? null,
      link: `${ONBOARDING_BASE_URL}/verifier?token=${token}`,
    }),
  })

  if (!sent.ok) {
    console.error("[verification] send failed", {
      personId: person.id,
      error: sent.error,
    })
    return { ok: false, status: "email_error", error: sent.error ?? "unknown" }
  }

  return { ok: true, status: "sent" }
}
