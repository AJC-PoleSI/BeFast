export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  generateVerificationToken,
  verificationEmailHtml,
} from "@/lib/auth/verification"
import { sendEmail } from "@/lib/email/send"
import { verifySignedRequest, ONBOARDING_BASE_URL } from "@/lib/integration/token"

const ALLOWED_EMAIL_DOMAIN = "audencia.com"
const VERIFICATION_SUBJECT = "Vérifiez votre adresse email — BeFast"

// POST /api/onboarding/register  (signé HMAC — appelé par le hub onboarding
// ou par RH lors d'une inscription directe). Crée le compte candidat BeFast
// (rôle `candidat`, cloisonné) et envoie UN email de vérification dont le
// lien pointe vers le hub d'onboarding. Idempotent, keyé sur l'email.
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  if (!verifySignedRequest(req, rawBody)) {
    return NextResponse.json({ error: "Signature invalide." }, { status: 401 })
  }

  let body: {
    firstName?: string
    lastName?: string
    email?: string
    password?: string
    dateOfBirth?: string
    source?: string
  }
  try {
    body = JSON.parse(rawBody || "{}")
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 })
  }

  const email = String(body.email ?? "").trim().toLowerCase()
  const prenom = String(body.firstName ?? "").trim()
  const nom = String(body.lastName ?? "").trim()
  const password = String(body.password ?? "")
  const dateOfBirth = body.dateOfBirth ?? null
  const source = body.source ?? "onboarding"

  if (!email || !prenom || !nom || password.length < 8) {
    return NextResponse.json(
      { error: "firstName, lastName, email, password (≥8) requis." },
      { status: 400 }
    )
  }
  if (!email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
    return NextResponse.json(
      { error: `Réservé aux adresses @${ALLOWED_EMAIL_DOMAIN}.` },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  try {
    // Rôle candidat (cloisonné).
    const { data: candRole } = await admin
      .from("profils_types")
      .select("id")
      .eq("slug", "candidat")
      .single()

    // Existe-t-il déjà une personne pour cet email ?
    const { data: existingRows } = await admin
      .from("personnes")
      .select("id, email_verified")
      .eq("email", email)
      .limit(1)
    const existing = existingRows?.[0]

    // Émission + envoi du token (facteur commun).
    const issueAndSend = async (personId: string) => {
      const { token, tokenHash, expiresAt } = generateVerificationToken()
      await admin
        .from("personnes")
        .update({
          verification_token_hash: tokenHash,
          verification_token_expires_at: expiresAt,
          email_verified: false,
        })
        .eq("id", personId)
      const link = `${ONBOARDING_BASE_URL}/verifier?token=${token}`
      await sendEmail({
        to: email,
        subject: VERIFICATION_SUBJECT,
        html: verificationEmailHtml({ prenom, link }),
      })
    }

    // Upsert du lien (Befast = maître).
    const upsertLink = async (personId: string) => {
      await admin
        .from("account_links")
        .upsert(
          { email, befast_person_id: personId },
          { onConflict: "email" }
        )
    }

    if (existing) {
      await upsertLink(existing.id)
      if (existing.email_verified) {
        // Déjà vérifié : rien à renvoyer (anti double-email).
        return NextResponse.json({ status: "exists_verified" })
      }
      await issueAndSend(existing.id)
      return NextResponse.json({ status: "pending" })
    }

    // Création du compte Supabase Auth (email non confirmé).
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
        user_metadata: { prenom, nom },
      })

    if (createErr || !created?.user?.id) {
      return NextResponse.json(
        { error: "Création du compte échouée.", details: createErr?.message },
        { status: 500 }
      )
    }

    const personId = created.user.id

    // Le trigger handle_new_user a créé la ligne personnes ; on la spécialise
    // en candidat cloisonné.
    await admin
      .from("personnes")
      .update({
        prenom,
        nom,
        date_of_birth: dateOfBirth,
        is_candidate: true,
        ...(candRole?.id ? { profil_type_id: candRole.id } : {}),
      })
      .eq("id", personId)

    await upsertLink(personId)
    await issueAndSend(personId)

    return NextResponse.json({ status: "pending", source })
  } catch (e) {
    return NextResponse.json(
      { error: "Erreur register.", details: String(e) },
      { status: 500 }
    )
  }
}
