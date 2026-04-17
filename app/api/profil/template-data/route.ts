import "server-only"

import { createClient } from "@/lib/supabase/server"
import { decryptFromString } from "@/lib/encryption"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    // Check if requesting own data or admin requesting other user's data
    const url = new URL(request.url)
    const targetUserId = url.searchParams.get("userId")
    const requestedId = targetUserId || user.id

    // If requesting another user's data, verify admin role
    if (targetUserId && targetUserId !== user.id) {
      const { data: adminProfile } = await supabase
        .from("personnes")
        .select("profils_types(slug)")
        .eq("id", user.id)
        .single()

      const slug = (adminProfile?.profils_types as { slug?: string } | null)
        ?.slug
      if (slug !== "administrateur") {
        return NextResponse.json(
          { error: "Accès non autorisé" },
          { status: 403 }
        )
      }
    }

    // Get user profile data
    const { data: profile, error: profileError } = await supabase
      .from("personnes")
      .select("*")
      .eq("id", requestedId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profil introuvable" },
        { status: 404 }
      )
    }

    // Get custom field values
    const { data: customFieldValues, error: customError } = await supabase
      .from("custom_field_values")
      .select("custom_fields(slug), value")
      .eq("user_id", requestedId)

    if (customError) {
      return NextResponse.json(
        { error: "Erreur lors de la récupération des champs" },
        { status: 500 }
      )
    }

    // Build template variables object
    const templateVars: Record<string, any> = {
      // Basic info
      id: profile.id,
      email: profile.email,
      prenom: profile.prenom || "",
      nom: profile.nom || "",
      portable: profile.portable || "",
      promo: profile.promo || "",
      adresse: profile.adresse || "",
      ville: profile.ville || "",
      code_postal: profile.code_postal || "",
      pole: profile.pole || "",
      etablissement: profile.etablissement || "",
      scolarite: profile.scolarite || "",
      date_naissance: profile.date_naissance || "",

      // Computed fields
      nom_complet: `${profile.prenom || ""} ${profile.nom || ""}`.trim(),
      initiales: `${(profile.prenom || "")[0] || ""}${(profile.nom || "")[0] || ""}`.toUpperCase(),

      // Sensitive fields (decrypted on backend only)
      nss_available: !!profile.nss_encrypted,
      iban_available: !!profile.iban_encrypted,
    }

    // Add decrypted sensitive data if available (only for the requesting user or admin on user's own profile)
    if (profile.nss_encrypted) {
      try {
        templateVars.nss = decryptFromString(profile.nss_encrypted)
      } catch {
        templateVars.nss = ""
      }
    }

    if (profile.iban_encrypted) {
      try {
        templateVars.iban = decryptFromString(profile.iban_encrypted)
      } catch {
        templateVars.iban = ""
      }
    }

    // Add custom field values
    (customFieldValues || []).forEach((cfv: any) => {
      const slug = cfv.custom_fields?.slug
      if (slug) {
        templateVars[slug] = cfv.value || ""
      }
    })

    return NextResponse.json({ variables: templateVars })
  } catch (error) {
    console.error("Template data error:", error)
    return NextResponse.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    )
  }
}
