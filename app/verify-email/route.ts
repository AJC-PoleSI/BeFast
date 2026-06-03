import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { hashToken, siteUrl } from "@/lib/auth/verification"

// GET /verify-email?token=<64-hex>
// Validates the one-time token, marks the account email_verified, clears the
// token. Always redirects (never leaks whether a token matched a real account
// beyond the generic invalid/expired states).
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

  // Already verified (token reused after success) — treat as success.
  if (personne.email_verified) {
    return NextResponse.redirect(`${base}/login?verified=1`)
  }

  const exp = personne.verification_token_expires_at
  if (!exp || new Date(exp).getTime() < Date.now()) {
    return NextResponse.redirect(`${base}/verifier-email?status=expired`)
  }

  await admin
    .from("personnes")
    .update({
      email_verified: true,
      verification_token_hash: null,
      verification_token_expires_at: null,
    })
    .eq("id", personne.id)

  return NextResponse.redirect(`${base}/login?verified=1`)
}
