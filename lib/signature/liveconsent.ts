import "server-only"

/**
 * Client REST LiveConsent (signature électronique) — https://liveconsent.readme.io
 *
 * Env requis (sinon l'intégration est désactivée proprement) :
 *   LIVECONSENT_USERNAME       — identifiant du compte API
 *   LIVECONSENT_DEVELOPER_KEY  — clé développeur
 *   LIVECONSENT_SECRET_KEY     — secret key (auth recommandée)
 *
 * Auth : POST /account/auth/api-secret-key → authorization_token valable 1 h,
 * mis en cache module ~50 min. Les appels suivants portent les headers
 * `developer_key` + `authorization_token`.
 */

const BASE = "https://api.liveconsent.com/LCSWS"

export function isLiveConsentConfigured(): boolean {
  return Boolean(
    process.env.LIVECONSENT_USERNAME &&
      process.env.LIVECONSENT_DEVELOPER_KEY &&
      process.env.LIVECONSENT_SECRET_KEY
  )
}

let cachedToken: { token: string; expiresAt: number } | null = null

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token

  const res = await fetch(`${BASE}/account/auth/api-secret-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: process.env.LIVECONSENT_USERNAME,
      developer_key: process.env.LIVECONSENT_DEVELOPER_KEY,
      secret_key: process.env.LIVECONSENT_SECRET_KEY,
    }),
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`LiveConsent auth ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json()
  const token = data.authorization_token ?? data.token ?? data.access_token
  if (!token) throw new Error("LiveConsent auth: token absent de la réponse")
  cachedToken = { token, expiresAt: Date.now() + 50 * 60 * 1000 }
  return token
}

async function lcFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getToken()
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      developer_key: process.env.LIVECONSENT_DEVELOPER_KEY!,
      authorization_token: token,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  })
}

export interface SignatureRecipient {
  firstname: string
  lastname: string
  email: string
  phone: string
  /** Ordre de signature (1 = premier). Utilisé quand `signInOrder` est vrai. */
  order?: number
}

export interface SignaturePlacement {
  /** Email du destinataire qui appose cette signature. */
  recipientEmail: string
  page: number
  x: number
  y: number
}

export interface CreateSignatureOpts {
  requestName: string
  message?: string
  /** PDF encodé en base64 (sans préfixe data:). */
  pdfBase64: string
  filename: string
  /** Un ou plusieurs destinataires (signataires). */
  recipients: SignatureRecipient[]
  /**
   * Positions des cachets de signature. Si omis, on place une signature par
   * destinataire à une position par défaut (à ajuster selon vos modèles).
   */
  signatures?: SignaturePlacement[]
  /** Signature en ordre (le 2e destinataire ne signe qu'après le 1er). */
  signInOrder?: boolean
  callbackUrl?: string
  validityDays?: number
}

const DEFAULT_SIGNATURE_POS = { page: 1, x: 120, y: 680 }

export async function createSignatureRequest(
  opts: CreateSignatureOpts
): Promise<{ requestId: string }> {
  if (!opts.recipients.length) {
    throw new Error("LiveConsent: au moins un destinataire est requis.")
  }

  // Une signature par destinataire par défaut, légèrement décalée verticalement
  // pour éviter le chevauchement quand aucune position explicite n'est fournie.
  const signatures =
    opts.signatures && opts.signatures.length
      ? opts.signatures
      : opts.recipients.map((r, i) => ({
          recipientEmail: r.email,
          page: DEFAULT_SIGNATURE_POS.page,
          x: DEFAULT_SIGNATURE_POS.x + i * 220,
          y: DEFAULT_SIGNATURE_POS.y,
        }))

  const res = await lcFetch(`/createrequest`, {
    method: "POST",
    body: JSON.stringify({
      request: {
        request_name: opts.requestName.slice(0, 255),
        request_message: (opts.message ?? "").slice(0, 255) || undefined,
        request_callback_url: opts.callbackUrl,
        request_validity_days: opts.validityDays ?? 30,
        request_notify_signature: true,
        request_sign_in_order: opts.signInOrder ? true : undefined,
      },
      documents: [
        {
          document_type: "base64",
          document_content: opts.pdfBase64,
          document_filename: opts.filename,
        },
      ],
      recipients: opts.recipients.map((r, i) => ({
        firstname: r.firstname,
        lastname: r.lastname,
        email: r.email,
        phone: r.phone,
        code_delivery: "email",
        recipient_order: opts.signInOrder ? r.order ?? i + 1 : undefined,
      })),
      signatures: signatures.map((s) => ({
        signature_recipient: s.recipientEmail,
        signature_document: opts.filename,
        signature_page_number: s.page,
        signature_position: `${s.x},${s.y}`,
        coordinates_type: "pdf",
      })),
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`LiveConsent createrequest ${res.status}: ${body.slice(0, 300)}`)
  }
  const data = await res.json()
  if (!data.request_id) throw new Error("LiveConsent: request_id absent de la réponse")
  return { requestId: String(data.request_id) }
}

/** Statut consolidé d'une demande (source de vérité côté LiveConsent). */
export async function getRequestStatus(requestId: string): Promise<string | null> {
  const res = await lcFetch(`/request/${encodeURIComponent(requestId)}/status`)
  if (!res.ok) return null
  const data = await res.json().catch(() => null)
  return data?.status != null ? String(data.status) : null
}

export async function abandonRequest(requestId: string): Promise<boolean> {
  const res = await lcFetch(`/request/${encodeURIComponent(requestId)}/abandon`, {
    method: "PUT",
  })
  return res.ok
}
