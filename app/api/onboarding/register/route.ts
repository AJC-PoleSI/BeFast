export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { issueAndSendVerification } from "@/lib/auth/issue-verification"
import { verifySignedRequest } from "@/lib/integration/token"

const ALLOWED_EMAIL_DOMAIN = "audencia.com"

// POST /api/onboarding/register  (signé HMAC — appelé par le hub onboarding
// ou par RH lors d'une inscription directe). Crée le compte candidat BeFast
// (rôle `candidat`, cloisonné) et envoie UN email de vérification dont le
// lien pointe vers le hub d'onboarding. Idempotent, keyé sur l'email.
//
// `sendVerification: false` (inscription miroir venue de RH) crée le compte
// sans email : RH a déjà envoyé le sien, et sa validation est propagée ici
// par /api/onboarding/mark-verified. Deux emails concurrents pour une seule
// inscription, c'est exactement ce qui a piégé les candidats jusqu'au
// 13/09/2026 — celui qu'ils ne cliquaient pas expirait en silence.
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
    sendVerification?: boolean
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
  const sendVerification = body.sendVerification !== false

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

    // Upsert du lien (Befast = maître).
    const upsertLink = async (personId: string) => {
      await admin
        .from("account_links")
        .upsert(
          { email, befast_person_id: personId },
          { onConflict: "email" }
        )
    }

    // Émission du token + envoi. Une erreur ici n'est plus avalée : mieux
    // vaut une 502 explicite qu'un « pending » qui laisse croire au renvoi.
    const issue = async (personId: string) => {
      const res = await issueAndSendVerification(admin, {
        id: personId,
        email,
        prenom,
      })
      if (!res.ok) {
        return NextResponse.json(
          { error: "Envoi du lien de vérification échoué.", status: res.status },
          { status: 502 }
        )
      }
      return null
    }

    if (existing) {
      await upsertLink(existing.id)
      if (existing.email_verified) {
        // Déjà vérifié : rien à renvoyer (anti double-email).
        return NextResponse.json({ status: "exists_verified" })
      }
      if (!sendVerification) {
        return NextResponse.json({ status: "exists_pending", emailSent: false })
      }
      const failed = await issue(existing.id)
      if (failed) return failed
      return NextResponse.json({ status: "pending", emailSent: true })
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
      console.error("[onboarding/register] createUser failed", {
        email,
        status: createErr?.status,
        code: (createErr as any)?.code,
        message: createErr?.message,
        existingRowsCount: existingRows?.length ?? 0,
      })
      return NextResponse.json(
        { error: "Création du compte échouée.", details: createErr?.message },
        { status: 500 }
      )
    }

    const personId = created.user.id

    // Le trigger handle_new_user a créé la ligne personnes ; on la spécialise
    // en candidat cloisonné.
    const { error: specializeErr } = await admin
      .from("personnes")
      .update({
        prenom,
        nom,
        date_of_birth: dateOfBirth,
        is_candidate: true,
        ...(candRole?.id ? { profil_type_id: candRole.id } : {}),
      })
      .eq("id", personId)

    if (specializeErr) {
      console.error("[onboarding/register] specialize personne failed", {
        email,
        message: specializeErr.message,
      })
      return NextResponse.json(
        { error: "Création du profil candidat échouée.", details: specializeErr.message },
        { status: 500 }
      )
    }

    await upsertLink(personId)

    if (!sendVerification) {
      return NextResponse.json({ status: "created_pending", emailSent: false, source })
    }

    const failed = await issue(personId)
    if (failed) return failed

    return NextResponse.json({ status: "pending", emailSent: true, source })
  } catch (e) {
    return NextResponse.json(
      { error: "Erreur register.", details: String(e) },
      { status: 500 }
    )
  }
}
