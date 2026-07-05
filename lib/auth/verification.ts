import "server-only"
import { randomBytes, createHash } from "crypto"

/** Verification token lifetime: 24 hours. */
export const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Password-reset token lifetime: 72 hours.
 * Supabase caps recovery/OTP links at 24h, so the emailed link uses this
 * custom high-entropy token instead; a short-lived Supabase recovery session
 * is minted on the fly only once the token is validated.
 */
export const PASSWORD_RESET_TTL_MS = 72 * 60 * 60 * 1000

/**
 * Generate a one-time email-verification token.
 * The raw token (64 hex chars) is sent in the email link; only its SHA-256
 * hash is ever persisted, so a database leak cannot be used to verify accounts.
 */
export function generateVerificationToken() {
  const token = randomBytes(32).toString("hex") // 64 hex chars
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS).toISOString()
  return { token, tokenHash, expiresAt }
}

/**
 * Generate a one-time password-reset token valid for 72h.
 * Same hardening as the verification token (only the SHA-256 hash is stored),
 * but with the 72h lifetime the campaign link must honour.
 */
export function generatePasswordResetToken() {
  const token = randomBytes(32).toString("hex") // 64 hex chars
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString()
  return { token, tokenHash, expiresAt }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

/** Canonical site URL (no trailing slash) for building absolute links. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "")
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function verificationEmailHtml(opts: { prenom?: string | null; link: string }): string {
  const hello = opts.prenom ? `Bonjour ${escapeHtml(opts.prenom)},` : "Bonjour,"
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#0b1437;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1437;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="440" cellpadding="0" cellspacing="0" style="background:#F5F0E8;border-radius:12px;padding:40px;">
            <tr><td style="font-size:24px;font-weight:bold;color:#caa64b;padding-bottom:24px;">BeFast</td></tr>
            <tr><td style="font-size:16px;color:#1f2937;padding-bottom:12px;">${hello}</td></tr>
            <tr><td style="font-size:14px;color:#374151;line-height:22px;padding-bottom:24px;">
              Merci de cr&eacute;er un compte sur BeFast. Confirmez votre adresse email en cliquant sur le bouton ci-dessous. Ce lien est valable 24&nbsp;heures.
            </td></tr>
            <tr><td align="center" style="padding-bottom:24px;">
              <a href="${opts.link}" style="display:inline-block;background:#caa64b;color:#0b1437;font-weight:bold;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;">
                V&eacute;rifier mon adresse email
              </a>
            </td></tr>
            <tr><td style="font-size:12px;color:#6b7280;line-height:18px;">
              Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur&nbsp;:<br/>
              <span style="color:#2563eb;word-break:break-all;">${opts.link}</span>
            </td></tr>
            <tr><td style="font-size:12px;color:#9ca3af;padding-top:24px;border-top:1px solid #e5e7eb;margin-top:24px;">
              Si vous n'&ecirc;tes pas &agrave; l'origine de cette demande, ignorez cet email.
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}
