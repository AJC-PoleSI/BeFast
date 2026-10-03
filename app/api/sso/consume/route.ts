export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { siteUrl } from "@/lib/auth/verification"
import { verifySsoToken } from "@/lib/integration/token"

// GET /api/sso/consume?token=…  (switch entrant depuis RH Manager)
// Vérifie le token SSO court, retrouve le compte, génère un magic-link
// Supabase et passe son token_hash à /auth/confirm → session BeFast ouverte.
export async function GET(req: NextRequest) {
  const base = siteUrl()
  const token = req.nextUrl.searchParams.get("token") ?? ""
  const payload = verifySsoToken(token, "befast")

  if (!payload) {
    return NextResponse.redirect(`${base}/login?sso=invalid`)
  }

  const email = payload.email.trim().toLowerCase()
  const admin = createAdminClient()

  // Le compte doit exister et être vérifié.
  const { data: rows } = await admin
    .from("personnes")
    .select("id, email_verified")
    .eq("email", email)
    .limit(1)
  const personne = rows?.[0]
  if (!personne || !personne.email_verified) {
    return NextResponse.redirect(`${base}/login?sso=unknown`)
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${base}/` },
  })

  // Pas l'`action_link` : Supabase y renvoie la session dans le fragment de
  // l'URL, que rien ne lisait (personne connectée sur /login). Le `token_hash`
  // est vérifié côté serveur par /auth/confirm, qui pose les cookies.
  const hashedToken = data?.properties?.hashed_token
  if (error || !hashedToken) {
    return NextResponse.redirect(`${base}/login?sso=error`)
  }

  return NextResponse.redirect(
    `${base}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=magiclink&next=/`
  )
}
