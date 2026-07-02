import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { siteUrl } from "@/lib/auth/verification"

// GET /auth/callback?code=<pkce>&next=/reset-password
// Échange le code PKCE contre une session (pose les cookies) puis redirige vers
// `next`. Utilisé par le flux « mot de passe oublié » (resetPasswordForEmail).
// `next` est restreint aux chemins internes (anti open-redirect).
export async function GET(req: NextRequest) {
  const base = siteUrl()
  const code = req.nextUrl.searchParams.get("code")
  const nextParam = req.nextUrl.searchParams.get("next") || "/dashboard"
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard"

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${base}${next}`)
  }

  return NextResponse.redirect(`${base}/login?error=lien_invalide`)
}
