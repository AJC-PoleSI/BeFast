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

const VERIFICATION_SUBJECT = "Vérifiez votre adresse email — BeFast"

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

export async function resetPassword(formData: FormData) {
  const supabase = createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(
    formData.get("email") as string,
    {
      redirectTo: `${siteUrl()}/auth/callback?next=/dashboard`,
    }
  )
  if (error)
    return { error: "Une erreur est survenue. Veuillez réessayer." }
  return { success: "Un email de réinitialisation a été envoyé." }
}
