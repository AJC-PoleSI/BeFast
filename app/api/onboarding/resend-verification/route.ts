export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  issueAndSendVerification,
  issuedWithinCooldown,
} from "@/lib/auth/issue-verification"
import { verifySignedRequest } from "@/lib/integration/token"

// POST /api/onboarding/resend-verification  (signé HMAC — appelé par le hub)
// { email } → réémet un lien de vérification si le compte est en attente.
//
// Un lien expiré ne doit plus être un cul-de-sac : jusqu'au 13/09/2026 la
// seule issue affichée était « recommencez l'inscription », qui échouait
// puisque le compte existait déjà.
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  if (!verifySignedRequest(req, rawBody)) {
    return NextResponse.json({ error: "Signature invalide." }, { status: 401 })
  }

  let email = ""
  try {
    email = String(JSON.parse(rawBody || "{}")?.email ?? "").trim().toLowerCase()
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 })
  }
  if (!email) {
    return NextResponse.json({ error: "email requis." }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: rows } = await admin
    .from("personnes")
    .select("id, prenom, email_verified, verification_token_expires_at")
    .eq("email", email)
    .limit(1)
  const personne = rows?.[0]

  // Anti-énumération : même réponse qu'un envoi réussi si l'adresse est
  // inconnue (le hub n'affiche jamais autre chose que « lien renvoyé »).
  if (!personne) {
    return NextResponse.json({ ok: true, status: "sent" })
  }
  if (personne.email_verified) {
    return NextResponse.json({ ok: true, status: "already" })
  }
  if (issuedWithinCooldown(personne.verification_token_expires_at)) {
    return NextResponse.json({ ok: true, status: "throttled" })
  }

  const res = await issueAndSendVerification(admin, {
    id: personne.id,
    email,
    prenom: personne.prenom,
  })

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, status: res.status, error: res.error },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true, status: "sent" })
}
