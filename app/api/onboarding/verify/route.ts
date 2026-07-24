export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { hashToken } from "@/lib/auth/verification"
import { provisionRhCandidate } from "@/lib/integration/rh-client"

// POST /api/onboarding/verify  { token }
// Le token de vérif fait office de credential (64-hex, hashé en base).
// Valide → confirme le compte BeFast → provisionne le miroir RH → lie les deux.
// Retourne { ok, email } ; le hub génère ensuite les liens SSO.
export async function POST(req: NextRequest) {
  let token = ""
  try {
    const body = await req.json()
    token = String(body?.token ?? "")
  } catch {
    /* ignore */
  }

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return NextResponse.json(
      { ok: false, status: "invalid" },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const tokenHash = hashToken(token)

  const { data: rows } = await admin
    .from("personnes")
    .select(
      "id, email, prenom, nom, date_of_birth, email_verified, verification_token_expires_at"
    )
    .eq("verification_token_hash", tokenHash)
    .limit(1)
  const personne = rows?.[0]

  if (!personne) {
    return NextResponse.json({ ok: false, status: "invalid" }, { status: 400 })
  }

  const email = String(personne.email).trim().toLowerCase()

  const ensureRhLinked = async () => {
    const prov = await provisionRhCandidate({
      email,
      firstName: personne.prenom ?? "",
      lastName: personne.nom ?? "",
      dateOfBirth: personne.date_of_birth ?? null,
      befastPersonId: personne.id,
      source: "onboarding",
    })
    if (prov.ok && prov.candidateId) {
      await admin
        .from("account_links")
        .update({ rh_candidate_id: prov.candidateId })
        .eq("email", email)
    }
    return prov
  }

  // Déjà vérifié (token rejoué) → succès idempotent, on s'assure du lien RH.
  if (personne.email_verified) {
    await ensureRhLinked()
    return NextResponse.json({ ok: true, status: "already", email })
  }

  const exp = personne.verification_token_expires_at
  if (!exp || new Date(exp).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, status: "expired" }, { status: 400 })
  }

  // Marque vérifié + purge le token.
  await admin
    .from("personnes")
    .update({
      email_verified: true,
      verification_token_hash: null,
      verification_token_expires_at: null,
    })
    .eq("id", personne.id)

  // Confirme le compte Supabase Auth (login mot de passe possible).
  await admin.auth.admin.updateUserById(personne.id, { email_confirm: true })

  // Provisionne / lie le miroir RH.
  await ensureRhLinked()

  return NextResponse.json({ ok: true, status: "verified", email })
}
