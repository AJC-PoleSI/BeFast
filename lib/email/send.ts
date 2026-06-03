import "server-only"

/**
 * Minimal Resend client over fetch (no extra dependency).
 * Requires RESEND_API_KEY and RESEND_FROM_EMAIL in the environment.
 * Returns a result object instead of throwing so callers can treat email
 * sending as best-effort (a failed email must not break account creation).
 */
const RESEND_ENDPOINT = "https://api.resend.com/emails"

export async function sendEmail(opts: {
  to: string
  subject: string
  html: string
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL

  if (!apiKey || !from) {
    console.error("[email] RESEND_API_KEY / RESEND_FROM_EMAIL not configured — email skipped")
    return { ok: false, error: "email_not_configured" }
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.error("[email] Resend send failed", res.status, body)
      return { ok: false, error: `resend_${res.status}` }
    }

    return { ok: true }
  } catch (e: any) {
    console.error("[email] Resend send threw", e?.message ?? e)
    return { ok: false, error: "network" }
  }
}
