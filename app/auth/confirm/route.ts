import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { siteUrl } from "@/lib/auth/verification"

// GET /auth/confirm?token_hash=…&type=magiclink&next=/
// Ouvre la session côté serveur à partir d'un lien Supabase `token_hash`
// (cookies posés par le client SSR), puis redirige vers `next`.
//
// Utilisé par le SSO entrant (/api/sso/consume). Avant le 02/10/2026, le SSO
// redirigeait vers l'`action_link` du magic link : Supabase y renvoie la
// session dans le fragment de l'URL (#access_token=…), qu'aucun code de Be
// Fast ne lisait — la personne arrivait sur /login sans être connectée.
//
// Seul `magiclink` est accepté : la réinitialisation de mot de passe a sa
// propre page (/reset-password). `next` est restreint aux chemins internes.
export async function GET(req: NextRequest) {
  const base = siteUrl()
  const tokenHash = req.nextUrl.searchParams.get("token_hash")
  const type = req.nextUrl.searchParams.get("type")
  const nextParam = req.nextUrl.searchParams.get("next") || "/"
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/"

  if (tokenHash && type === "magiclink") {
    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" })
    if (!error) return NextResponse.redirect(`${base}${next}`)
    console.warn("[auth/confirm] verifyOtp refusé", error.code ?? error.message)
  }

  return NextResponse.redirect(`${base}/login?sso=error`)
}
