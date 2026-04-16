"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { PersonneWithRole } from "@/types/database.types"

async function getCallerRole(): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data } = await admin
    .from("personnes")
    .select("profils_types(slug)")
    .eq("id", user.id)
    .single()

  return (data?.profils_types as any)?.slug ?? null
}

export async function getAllMembers(): Promise<{ data: PersonneWithRole[] | null; error: string | null }> {
  const role = await getCallerRole()
  if (role !== "administrateur") {
    return { data: null, error: "Non autorisé" }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("personnes")
    .select("*, profils_types(*)")
    .order("created_at", { ascending: false })

  if (error) return { data: null, error: error.message }
  return { data: data as PersonneWithRole[], error: null }
}

export async function updateMemberRole(personneId: string, roleSlug: string) {
  const role = await getCallerRole()
  if (role !== "administrateur") {
    return { success: false, error: "Seul un administrateur peut modifier les rôles." }
  }

  const admin = createAdminClient()

  const { data: profil, error: profilError } = await admin
    .from("profils_types")
    .select("id")
    .eq("slug", roleSlug)
    .single()

  if (profilError) return { success: false, error: "Rôle introuvable" }

  const { error } = await admin
    .from("personnes")
    .update({ profil_type_id: profil.id })
    .eq("id", personneId)

  if (error) return { success: false, error: error.message }
  return { success: true, profil: { id: profil.id, slug: roleSlug } }
}

export async function getAllRoles() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("profils_types")
    .select("*")
    .order("nom")

  if (error) return { data: null, error: error.message }
  return { data, error: null }
}

export async function updateRolePermissions(roleId: string, permissions: Record<string, boolean>) {
  const role = await getCallerRole()
  if (role !== "administrateur") {
    return { success: false, error: "Non autorisé" }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from("profils_types")
    .update({ permissions })
    .eq("id", roleId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}
