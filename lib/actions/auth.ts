"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import {
  generateVerificationToken,
  verificationEmailHtml,
  siteUrl,
} from "@/lib/auth/verification"
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
  await admin
    .from("personnes")
    .update({
      verification_token_hash: tokenHash,
      verification_token_expires_at: expiresAt,
      email_verified: false,
    })
    .eq("id", userId)

  const link = `${siteUrl()}/verify-email?token=${token}`
  // Best-effort: a failed email must not break the flow.
  await sendEmail({
    to: email,
    subject: VERIFICATION_SUBJECT,
    html: verificationEmailHtml({ prenom, link }),
  })
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
  const email = ((formData.get("email") as string) ?? "").trim().toLowerCase()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: formData.get("password") as string,
  })
  if (error || !data.user) {
    return {
      error: "Identifiants incorrects. Vérifiez votre email et mot de passe.",
    }
  }

  // Gate: the email must be verified before any session is granted.
  const admin = createAdminClient()
  const { data: rows } = await admin
    .from("personnes")
    .select("email_verified")
    .eq("id", data.user.id)
    .limit(1)
  const personne = rows?.[0]

  if (personne && personne.email_verified === false) {
    await supabase.auth.signOut()
    return {
      error:
        "Votre adresse email n'est pas encore vérifiée. Consultez votre boîte de réception (ou renvoyez un email de vérification).",
      needsVerification: true,
    }
  }

  redirect("/dashboard")
}

export async function signUp(formData: FormData) {
  const supabase = createClient()
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

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { prenom, nom },
    },
  })

  if (error) {
    if (error.message.includes("already registered")) {
      return {
        error: "Un compte existe déjà avec cette adresse email.",
      }
    }
    return { error: "Une erreur est survenue. Veuillez réessayer." }
  }

  // The handle_new_user trigger has created the matching `personnes` row.
  // Attach a verification token and send the email (best-effort).
  if (data.user?.id) {
    await issueVerification(data.user.id, email, prenom)
    // Notifie l'ouverture du compte : nouveau membre + admins + Responsable RH.
    await notifyAccountOpened({ email, prenom, nom })
  }

  redirect("/verifier-email")
}

export async function resendVerification(formData: FormData) {
  const email = ((formData.get("email") as string) ?? "").trim().toLowerCase()
  if (!email) return { success: RESEND_GENERIC }

  const admin = createAdminClient()
  const { data: rows } = await admin
    .from("personnes")
    .select("id, prenom, email_verified")
    .eq("email", email)
    .limit(1)
  const personne = rows?.[0]

  if (personne && personne.email_verified === false) {
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
