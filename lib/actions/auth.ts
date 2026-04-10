"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function signIn(formData: FormData) {
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  })
  if (error)
    return {
      error:
        "Identifiants incorrects. Vérifiez votre email et mot de passe.",
    }
  redirect("/dashboard")
}

export async function signUp(formData: FormData) {
  const supabase = createClient()
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

  const { error } = await supabase.auth.signUp({
    email: formData.get("email") as string,
    password,
    options: {
      data: {
        prenom: formData.get("prenom") as string,
        nom: formData.get("nom") as string,
      },
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

  redirect("/attente")
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
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback?next=/dashboard`,
    }
  )
  if (error)
    return { error: "Une erreur est survenue. Veuillez réessayer." }
  return { success: "Un email de réinitialisation a été envoyé." }
}
