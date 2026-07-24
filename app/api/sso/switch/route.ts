export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { signSsoToken, RH_BASE_URL } from "@/lib/integration/token"

// GET /api/sso/switch  (bouton « Aller sur RH Manager » côté BeFast)
// Signe un token SSO court pour la session courante et redirige vers le
// consume RH. Aucune ressaisie de mot de passe.
export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.redirect(`${RH_BASE_URL}/login`)
  }

  const token = signSsoToken(user.email, "rh")
  return NextResponse.redirect(`${RH_BASE_URL}/api/sso/consume?token=${token}`)
}
