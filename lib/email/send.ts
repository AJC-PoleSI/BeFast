import "server-only"

/**
 * Email sending with Resend as primary and Brevo as fallback (Resend's free
 * tier is capped at 100/day, which self-service password resets can exceed).
 * Returns a result object instead of throwing so callers can treat email
 * sending as best-effort (a failed email must not break account creation).
 */
const RESEND_ENDPOINT = "https://api.resend.com/emails"
const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email"

type SendResult = { ok: boolean; error?: string }

async function sendViaResend(opts: { to: string; subject: string; html: string }): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL

  if (!apiKey || !from) {
    return { ok: false, error: "resend_not_configured" }
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
    return { ok: false, error: "resend_network" }
  }
}

async function sendViaBrevo(opts: { to: string; subject: string; html: string }): Promise<SendResult> {
  const apiKey = process.env.BREVO_API_KEY
  const from = process.env.BREVO_FROM_EMAIL

  if (!apiKey || !from) {
    return { ok: false, error: "brevo_not_configured" }
  }

  try {
    const res = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: from, name: "Audencia Junior Conseil" },
        to: [{ email: opts.to }],
        subject: opts.subject,
        htmlContent: opts.html,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.error("[email] Brevo send failed", res.status, body)
      return { ok: false, error: `brevo_${res.status}` }
    }

    return { ok: true }
  } catch (e: any) {
    console.error("[email] Brevo send threw", e?.message ?? e)
    return { ok: false, error: "brevo_network" }
  }
}

export async function sendEmail(opts: {
  to: string
  subject: string
  html: string
}): Promise<SendResult> {
  const primary = await sendViaResend(opts)
  if (primary.ok) return primary

  console.error("[email] Resend failed, falling back to Brevo", primary.error)
  const fallback = await sendViaBrevo(opts)
  if (fallback.ok) return fallback

  console.error("[email] Brevo fallback also failed", fallback.error)
  return { ok: false, error: `${primary.error}_then_${fallback.error}` }
}
