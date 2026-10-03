"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import {
  generateVerificationToken,
  verificationEmailHtml,
  siteUrl,
} from "@/lib/auth/verification"
import { issuedWithinCooldown } from "@/lib/auth/issue-verification"
import { decideLogin } from "@/lib/auth/login-gate"
import { sendEmail } from "@/lib/email/send"
import {
  accountCreatedUserEmail,
  newAccountStaffNotificationEmail,
  passwordResetEmail,
} from "@/lib/email/templates"

const VERIFICATION_SUBJECT = "Vérifiez votre adresse email — BeFast"

// Seul ce domaine peut créer un compte (membres Audencia Junior Conseil).
const ALLOWED_EMAIL_DOMAIN = "audencia.com"

// Generic message used for resend (anti-enumeration: identical reply whether
// or not the address maps to an existing, unverified account).
const RESEND_GENERIC =
  "Si un compte non vérifié existe pour cette adresse, un email de vérification vient d'être envoyé."

async function issueVerification(
  userId: string,
  email: string,
  prenom?: string | null
) {
  const { token, tokenHash, expiresAt } = generateVerificationToken()
  const admin = createAdminClient()
  const { error: dbErr } = await admin
    .from("personnes")
    .update({
      verification_token_hash: tokenHash,
      verification_token_expires_at: expiresAt,
      email_verified: false,
    })
    .eq("id", userId)
  if (dbErr) {
    // Sans jeton en base, le lien envoyé serait mort : on n'envoie rien.
    console.error("[auth/issueVerification] écriture du jeton", dbErr.message)
    return
  }

  const link = `${siteUrl()}/verify-email?token=${token}`
  // Best-effort: a failed email must not break the flow.
  const sent = await sendEmail({
    to: email,
    subject: VERIFICATION_SUBJECT,
    html: verificationEmailHtml({ prenom, link }),
  })
  if (!sent.ok) console.error("[auth/issueVerification] envoi impossible", sent.error)
}

// Destinataires de l'alerte « nouveau compte » : administrateurs (rôle de base)
// + porteurs du poste Responsable RH. Best-effort et tolérant (table de postes
// éventuellement absente) : on ne bloque jamais la création de compte.
async function collectStaffEmails(
  admin: ReturnType<typeof createAdminClient>
): Promise<string[]> {
  const emails = new Set<string>()

  try {
    const { data: adminRole } = await admin
      .from("profils_types")
      .select("id")
      .eq("slug", "administrateur")
      .single()
    if (adminRole?.id) {
      const { data: admins } = await admin
        .from("personnes")
        .select("email")
        .eq("profil_type_id", adminRole.id)
      for (const p of admins ?? []) if (p?.email) emails.add(p.email)
    }
  } catch {
    /* best-effort */
  }

  try {
    const { data: rhPoste } = await admin
      .from("profils_types")
      .select("id")
      .eq("slug", "responsable_rh")
      .single()
    if (rhPoste?.id) {
      const { data: links } = await admin
        .from("personne_postes")
        .select("personne_id")
        .eq("poste_id", rhPoste.id)
      const ids = [...new Set((links ?? []).map((l: any) => l.personne_id))]
      if (ids.length) {
        const { data: people } = await admin
          .from("personnes")
          .select("email")
          .in("id", ids)
        for (const p of people ?? []) if (p?.email) emails.add(p.email)
      }
    }
  } catch {
    /* best-effort */
  }

  return [...emails]
}

// Notifie l'ouverture d'un compte : confirmation au nouveau membre + alerte
// aux administrateurs et au Responsable RH. Entièrement best-effort.
async function notifyAccountOpened(opts: {
  email: string
  prenom?: string | null
  nom?: string | null
}) {
  const admin = createAdminClient()

  const userTpl = accountCreatedUserEmail(opts.prenom ?? null)
  await sendEmail({ to: opts.email, subject: userTpl.subject, html: userTpl.html })

  const staffEmails = (await collectStaffEmails(admin)).filter(
    (e) => e.toLowerCase() !== opts.email.toLowerCase()
  )
  if (staffEmails.length) {
    const staffTpl = newAccountStaffNotificationEmail({
      prenom: opts.prenom ?? null,
      nom: opts.nom ?? null,
      email: opts.email,
    })
    await Promise.all(
      staffEmails.map((to) =>
        sendEmail({ to, subject: staffTpl.subject, html: staffTpl.html })
      )
    )
  }
}

export async function signIn(formData: FormData) {
  const supabase = createClient()
  const admin = createAdminClient()
  const email = ((formData.get("email") as string) ?? "").trim().toLowerCase()
  const password = formData.get("password") as string

  let { data, error } = await supabase.auth.signInWithPassword({ email, password })

  // Sur échec, Supabase ne renvoie pas l'utilisateur : on retrouve la ligne
  // par l'email (toujours stocké en minuscules).
  const { data: rows } = data.user
    ? await admin.from("personnes").select("id, email_verified").eq("id", data.user.id).limit(1)
    : await admin.from("personnes").select("id, email_verified").eq("email", email).limit(1)
  const personne = rows?.[0] as { id: string; email_verified: boolean | null } | undefined
  const appEmailVerified = personne ? personne.email_verified !== false : null

  const errorCode = (e: typeof error) =>
    e ? (e.code ?? (e.status === 429 ? "over_request_rate_limit" : "unknown")) : null

  let decision = decideLogin({
    authErrorCode: errorCode(error),
    authEmailConfirmed: !!data.user?.email_confirmed_at,
    appEmailVerified,
  })

  if (decision.kind === "confirm_auth_and_retry" && personne) {
    const { error: confirmErr } = await admin.auth.admin.updateUserById(personne.id, {
      email_confirm: true,
    })
    if (confirmErr) {
      console.error("[auth/signIn] confirmation Supabase impossible", confirmErr.code ?? confirmErr.message)
    } else {
      ;({ data, error } = await supabase.auth.signInWithPassword({ email, password }))
      decision = decideLogin({
        authErrorCode: errorCode(error),
        authEmailConfirmed: !!data.user?.email_confirmed_at,
        appEmailVerified: true,
      })
    }
  }

  if (error) {
    // Seul le code part dans les logs : avant, chaque refus était muet.
    console.warn("[auth/signIn] refus Supabase", errorCode(error))
  }

  switch (decision.kind) {
    case "ok":
      if (decision.healAppFlag && personne) {
        const { error: healErr } = await admin
          .from("personnes")
          .update({ email_verified: true })
          .eq("id", personne.id)
        if (healErr) console.error("[auth/signIn] resynchronisation email_verified", healErr.message)
      }
      redirect("/")
    case "needs_verification":
      if (data.user) await supabase.auth.signOut()
      return {
        error:
          "Votre adresse email n'est pas encore vérifiée. Cliquez sur le lien reçu par email, ou demandez-en un nouveau.",
        needsVerification: true,
      }
    case "bad_credentials":
      return { error: "Email ou mot de passe incorrect." }
    case "rate_limited":
      return {
        error: "Trop de tentatives de connexion. Patientez quelques minutes puis réessayez.",
      }
    default:
      return {
        error: "Connexion impossible pour le moment. Réessayez dans quelques minutes.",
      }
  }
}

export async function signUp(formData: FormData) {
  const email = ((formData.get("email") as string) ?? "").trim().toLowerCase()
  const prenom = (formData.get("prenom") as string) ?? ""
  const nom = (formData.get("nom") as string) ?? ""
  const password = formData.get("password") as string
  const confirmPassword = formData.get("confirmPassword") as string

  // Réservé aux adresses @audencia.com (membres Audencia Junior Conseil).
  if (!email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
    return {
      error: `La création de compte est réservée aux adresses @${ALLOWED_EMAIL_DOMAIN}.`,
    }
  }

  if (password !== confirmPassword) {
    return { error: "Les mots de passe ne correspondent pas." }
  }
  if (password.length < 8) {
    return {
      error: "Le mot de passe doit contenir au moins 8 caractères.",
    }
  }

  // Création par l'API admin, comme le parcours candidat (/api/onboarding/
  // register), et non par `supabase.auth.signUp` : ce dernier faisait partir,
  // en plus de notre email, l'email de confirmation natif de Supabase (en
  // anglais, par son SMTP limité à quelques envois par heure). Deux liens dont
  // chacun ne validait qu'un des deux indicateurs de vérification : cliquer
  // celui de Supabase laissait le compte bloqué (incident du 02/10/2026).
  // `createUser` n'envoie aucun email ; seul notre lien `/verify-email` reste,
  // et il confirme les deux indicateurs.
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: { prenom, nom },
  })

  const alreadyRegistered =
    error?.code === "email_exists" || /already (been )?registered/i.test(error?.message ?? "")

  if (error && !alreadyRegistered) {
    console.error("[auth/signUp] createUser", error.code ?? error.message)
    if (error.code === "weak_password") {
      return { error: "Ce mot de passe est trop faible. Choisissez-en un plus long ou plus varié." }
    }
    return { error: "Une erreur est survenue. Veuillez réessayer." }
  }

  // Adresse déjà prise : une nouvelle tentative ne doit pas rejouer le flux
  // « nouveau compte » (email au jeton orphelin, « compte créé », alerte à
  // tous les admins — une candidate bloquée a ainsi réessayé 5 fois le
  // 21/09/2026).
  if (alreadyRegistered || !data.user?.id) {
    const { data: rows } = await admin
      .from("personnes")
      .select("id, prenom, email_verified, verification_token_expires_at")
      .eq("email", email)
      .limit(1)
    const personne = rows?.[0]

    // Compte existant jamais vérifié : renvoyer le lien est la seule action
    // utile. Le cooldown évite qu'un second essai invalide un lien tout juste
    // émis (le nouveau jeton écrase l'ancien).
    if (personne && personne.email_verified === false) {
      if (!issuedWithinCooldown(personne.verification_token_expires_at)) {
        await issueVerification(personne.id, email, personne.prenom)
      }
      redirect("/verifier-email")
    }

    // Compte existant et déjà vérifié : aucun email, aucune alerte — on oriente
    // vers la connexion ou la réinitialisation du mot de passe.
    return {
      error:
        "Un compte existe déjà avec cette adresse email. Connectez-vous, ou utilisez « Mot de passe oublié » si vous ne vous en souvenez plus.",
    }
  }

  // The handle_new_user trigger has created the matching `personnes` row.
  // Attach a verification token and send the email (best-effort).
  await issueVerification(data.user.id, email, prenom)
  // Notifie l'ouverture du compte : nouveau membre + admins + Responsable RH.
  await notifyAccountOpened({ email, prenom, nom })

  redirect("/verifier-email")
}

export async function resendVerification(formData: FormData) {
  const email = ((formData.get("email") as string) ?? "").trim().toLowerCase()
  if (!email) return { success: RESEND_GENERIC }

  const admin = createAdminClient()
  const { data: rows } = await admin
    .from("personnes")
    .select("id, prenom, email_verified, verification_token_expires_at")
    .eq("email", email)
    .limit(1)
  const personne = rows?.[0]

  // Délai minimal : chaque envoi écrase le jeton précédent, un double clic sur
  // « Renvoyer » rendait mort le lien qui venait de partir.
  if (
    personne &&
    personne.email_verified === false &&
    !issuedWithinCooldown(personne.verification_token_expires_at)
  ) {
    await issueVerification(personne.id, email, personne.prenom)
  }

  // Always return the same message regardless of account existence/state.
  return { success: RESEND_GENERIC }
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

// Generic message used for password reset (anti-enumeration: identical reply
// whether or not the address maps to an existing account).
const RESET_GENERIC =
  "Si un compte existe pour cette adresse, un email de réinitialisation vient d'être envoyé."

// Le flux "mot de passe oublié" mint un lien à token_hash (verifyOtp côté
// /reset-password) au lieu de s'appuyer sur resetPasswordForEmail + l'échange
// PKCE de /auth/callback : ce dernier exige que le lien soit ouvert sur le
// même navigateur que celui qui a fait la demande (le code_verifier PKCE est
// local à ce navigateur), ce qui échoue silencieusement dès que le lien est
// ouvert ailleurs (mail sur téléphone, autre navigateur…). token_hash est
// vérifié côté serveur Supabase et fonctionne depuis n'importe quel appareil.
export async function resetPassword(formData: FormData) {
  const email = ((formData.get("email") as string) ?? "").trim().toLowerCase()
  if (!email) return { success: RESET_GENERIC }

  try {
    const admin = createAdminClient()
    const { data: link, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${siteUrl()}/reset-password` },
    })

    const tokenHash = link?.properties?.action_link
      ? new URL(link.properties.action_link).searchParams.get("token")
      : null

    if (!error && tokenHash) {
      const { data: rows } = await admin
        .from("personnes")
        .select("prenom")
        .eq("email", email)
        .limit(1)

      const resetLink = `${siteUrl()}/reset-password?token_hash=${tokenHash}&type=recovery`
      const tpl = passwordResetEmail({ prenom: rows?.[0]?.prenom ?? null, link: resetLink })
      await sendEmail({ to: email, subject: tpl.subject, html: tpl.html })
    }
  } catch (e) {
    console.error("[resetPassword]", e)
  }

  // Always return the same message regardless of account existence/errors.
  return { success: RESET_GENERIC }
}
