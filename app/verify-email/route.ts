import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { hashToken, siteUrl } from "@/lib/auth/verification"

// GET /verify-email?token=<64-hex>
// Validates the token and marks the email verified on BOTH sides (personnes +
// Supabase Auth). The token is kept afterwards so that a second click lands on
// the "already verified" success. Always redirects (never leaks whether a
// token matched a real account beyond the generic invalid/expired states).
//
// NOTE (intégration RH) : cette route est celle des inscriptions BeFast
// « classiques » (membres AGC). Elle NE crée AUCUN compte RH Manager et n'a
// aucun lien avec le recrutement. Le provisioning RH se fait uniquement dans
// le flux candidat `/api/onboarding/verify` (hub d'onboarding).
export async function GET(req: NextRequest) {
  const base = siteUrl()
  const token = req.nextUrl.searchParams.get("token")

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return NextResponse.redirect(`${base}/verifier-email?status=invalid`)
  }

  const admin = createAdminClient()
  const tokenHash = hashToken(token)

  const { data: rows, error } = await admin
    .from("personnes")
    .select("id, verification_token_expires_at, email_verified")
    .eq("verification_token_hash", tokenHash)
    .limit(1)

  const personne = rows?.[0]
  if (error || !personne) {
    return NextResponse.redirect(`${base}/verifier-email?status=invalid`)
  }

  // Déjà vérifié : un second clic (téléphone puis ordinateur, ou l'antivirus
  // de la messagerie qui a ouvert le lien avant la personne) est un succès.
  // Le jeton est conservé après vérification précisément pour arriver ici
  // plutôt que sur « lien invalide ». On reconfirme Supabase au passage.
  if (personne.email_verified) {
    await confirmSupabaseEmail(admin, personne.id)
    return NextResponse.redirect(`${base}/login?verified=1`)
  }

  const exp = personne.verification_token_expires_at
  if (!exp || new Date(exp).getTime() < Date.now()) {
    return NextResponse.redirect(`${base}/verifier-email?status=expired`)
  }

  const { error: updateErr } = await admin
    .from("personnes")
    .update({ email_verified: true })
    .eq("id", personne.id)

  if (updateErr) {
    console.error("[verify-email] écriture email_verified", updateErr.message)
    return NextResponse.redirect(`${base}/verifier-email?status=error`)
  }

  // Avant le 02/10/2026, ce lien ne validait que `personnes` : sans la
  // confirmation Supabase, la connexion était refusée (« Email not
  // confirmed », affiché « Identifiants incorrects »).
  await confirmSupabaseEmail(admin, personne.id)

  return NextResponse.redirect(`${base}/login?verified=1`)
}

/** Best-effort : la connexion resynchronise aussi en cas d'échec ici. */
async function confirmSupabaseEmail(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
) {
  const { error } = await admin.auth.admin.updateUserById(userId, { email_confirm: true })
  if (error) console.error("[verify-email] confirmation Supabase", error.code ?? error.message)
}
