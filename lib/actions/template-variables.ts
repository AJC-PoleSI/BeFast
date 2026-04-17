"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { decryptFromString } from "@/lib/encryption"

/**
 * Récupère toutes les variables de template pour un utilisateur
 * Inclut les champs fixes + les champs dynamiques
 * @param userId - ID de l'utilisateur
 * @returns Objet avec toutes les variables de template
 */
export async function getProfileTemplateVariables(userId: string) {
  try {
    const admin = createAdminClient()

    // Get user profile data
    const { data: profile, error: profileError } = await admin
      .from("personnes")
      .select("*")
      .eq("id", userId)
      .single()

    if (profileError || !profile) {
      throw new Error("Profil introuvable")
    }

    // Get custom field values
    const { data: customFieldValues, error: customError } = await admin
      .from("custom_field_values")
      .select("custom_fields(slug), value")
      .eq("user_id", userId)

    if (customError) {
      throw new Error("Erreur lors de la récupération des champs")
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

      // Sensitive fields availability
      nss_available: !!profile.nss_encrypted,
      iban_available: !!profile.iban_encrypted,
    }

    // Add decrypted sensitive data if available
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

    return templateVars
  } catch (error) {
    console.error("Error getting template variables:", error)
    throw error
  }
}

/**
 * Remplace les balises de template dans un texte avec les valeurs réelles
 * @param template - Texte contenant des balises {{variable}}
 * @param variables - Objet des variables à substituer
 * @returns Texte avec balises remplacées
 */
export function interpolateTemplate(
  template: string,
  variables: Record<string, any>
): string {
  let result = template

  // Replace all {{variable}} patterns
  const pattern = /\{\{(\w+)\}\}/g
  result = result.replace(pattern, (match, variable) => {
    return String(variables[variable] ?? match)
  })

  return result
}

/**
 * Valide qu'un template contient uniquement des variables existantes
 * @param template - Template à valider
 * @param availableVariables - Variables disponibles
 * @returns Array des variables manquantes (vide si valide)
 */
export function validateTemplate(
  template: string,
  availableVariables: Record<string, any>
): string[] {
  const missing: string[] = []
  const pattern = /\{\{(\w+)\}\}/g
  let match

  while ((match = pattern.exec(template)) !== null) {
    const variable = match[1]
    if (!(variable in availableVariables)) {
      if (!missing.includes(variable)) {
        missing.push(variable)
      }
    }
  }

  return missing
}
