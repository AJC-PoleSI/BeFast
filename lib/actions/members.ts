"use server"

import { createClient } from "@/lib/supabase/server"

export async function updateMemberRole(personneId: string, roleSlug: string) {
  const supabase = createClient()

  // Get profil type id
  const { data: profil, error: profilError } = await supabase
    .from("profils_types")
    .select("id")
    .eq("slug", roleSlug)
    .single()

  if (profilError) {
    return { success: false, error: "Rôle introuvable" }
  }

  // Update personne
  const { error } = await supabase
    .from("personnes")
    .update({ profil_type_id: profil.id })
    .eq("id", personneId)

  if (error) {
    return { success: false, error: error.message }
  }

  // Return updated profil
  return { success: true, profil: { id: profil.id, slug: roleSlug } }
}
