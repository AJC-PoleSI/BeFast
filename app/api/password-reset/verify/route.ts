import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { hashToken, siteUrl } from "@/lib/auth/verification"

export const dynamic = "force-dynamic"

// GET /api/password-reset/verify?rt=<64-hex>
// Valide le token custom 72h de la campagne mot de passe. S'il est valide (et
// non expiré), génère à la volée une session recovery Supabase — courte durée,
// plafonnée à 24h côté Supabase mais consommée dans la foulée — puis redirige
// vers /reset-password avec le token_hash frais que la page consomme via
// verifyOtp. Ce pont permet au lien emailé de rester valable 72h malgré le
// plafond de 24h imposé par Supabase sur les liens recovery/OTP.
export async function GET(req: NextRequest) {
  const base = siteUrl()
  const token = req.nextUrl.searchParams.get("rt")

  const invalid = `${base}/reset-password?e=invalid`
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return NextResponse.redirect(invalid)
  }

  const admin = createAdminClient()
  const tokenHash = hashToken(token)

  const { data: rows, error } = await admin
    .from("personnes")
    .select("id, email, reset_token_expires_at")
    .eq("reset_token_hash", tokenHash)
    .limit(1)

  const personne = rows?.[0]
  if (error || !personne) {
    return NextResponse.redirect(invalid)
  }

  const exp = personne.reset_token_expires_at
  if (!exp || new Date(exp).getTime() < Date.now()) {
    return NextResponse.redirect(`${base}/reset-password?e=expired`)
  }

  // Token custom valide → mint une session recovery Supabase à la volée.
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: personne.email as string,
    options: { redirectTo: `${base}/reset-password` },
  })
  const otp = link?.properties?.action_link
    ? new URL(link.properties.action_link).searchParams.get("token")
    : null
  if (linkErr || !otp) {
    return NextResponse.redirect(invalid)
  }

  return NextResponse.redirect(`${base}/reset-password?token_hash=${otp}`)
}
