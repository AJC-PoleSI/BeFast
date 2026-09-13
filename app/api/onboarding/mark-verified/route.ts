export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifySignedRequest } from "@/lib/integration/token"

// POST /api/onboarding/mark-verified  (signé HMAC — appelé par RH Manager)
// { email } → marque l'adresse vérifiée côté BeFast.
//
// Une inscription = une identité, donc une seule vérification à faire par le
// candidat. Befast → RH était déjà couvert (/api/internal/provision pose
// email_verified). Cette route ferme le sens inverse : sans elle, valider son
// email sur RH laissait le compte BeFast en attente derrière un lien qui
// finissait par expirer (incident du 13/09/2026, 17 candidats concernés).
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

  const { data: rows, error: readErr } = await admin
    .from("personnes")
    .select("id, email_verified")
    .eq("email", email)
    .limit(1)

  if (readErr) {
    return NextResponse.json(
      { error: "Lecture personne échouée.", details: readErr.message },
      { status: 500 }
    )
  }

  const personne = rows?.[0]
  if (!personne) {
    // Pas de compte BeFast miroir : l'appelant doit le savoir (le miroir a
    // probablement échoué à l'inscription) plutôt que de croire au succès.
    return NextResponse.json({ ok: false, status: "unknown" }, { status: 404 })
  }

  if (personne.email_verified) {
    return NextResponse.json({ ok: true, status: "already" })
  }

  const { error: updateErr } = await admin
    .from("personnes")
    .update({
      email_verified: true,
      verification_token_hash: null,
      verification_token_expires_at: null,
    })
    .eq("id", personne.id)

  if (updateErr) {
    console.error("[onboarding/mark-verified] update failed", {
      email,
      message: updateErr.message,
    })
    return NextResponse.json(
      { error: "Mise à jour échouée.", details: updateErr.message },
      { status: 500 }
    )
  }

  // Confirme aussi le compte Supabase Auth, sinon la connexion reste refusée.
  const { error: authErr } = await admin.auth.admin.updateUserById(personne.id, {
    email_confirm: true,
  })
  if (authErr) {
    console.error("[onboarding/mark-verified] auth confirm failed", {
      email,
      message: authErr.message,
    })
    return NextResponse.json(
      { error: "Confirmation Auth échouée.", details: authErr.message },
      { status: 500 }
    )
  }

  await admin
    .from("account_links")
    .upsert({ email, befast_person_id: personne.id }, { onConflict: "email" })

  return NextResponse.json({ ok: true, status: "verified" })
}
