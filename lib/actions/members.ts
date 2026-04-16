"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { PersonneWithRole } from "@/types/database.types"

async function getCallerRole(): Promise<string | null> {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      console.error("[getCallerRole] Auth error:", authError.message)
      return null
    }

    if (!user) {
      console.log("[getCallerRole] No user found")
      return null
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from("personnes")
      .select("profils_types(slug)")
      .eq("id", user.id)
      .single()

    if (error) {
      console.error("[getCallerRole] Query error:", error.message)
      return null
    }

    const role = (data?.profils_types as any)?.slug ?? null
    console.log(`[getCallerRole] User ${user.email} has role:`, role)
    return role
  } catch (err) {
    console.error("[getCallerRole] Exception:", err)
    return null
  }
}

export async function getAllMembers(): Promise<{ data: PersonneWithRole[] | null; error: string | null }> {
  try {
    console.log("[getAllMembers] Starting...")

    const role = await getCallerRole()
    console.log("[getAllMembers] Caller role:", role)

    if (role !== "administrateur") {
      console.warn("[getAllMembers] Unauthorized - not admin")
      return { data: null, error: "Non autorisé" }
    }

    const admin = createAdminClient()
    console.log("[getAllMembers] Fetching from personnes...")

    const { data, error } = await admin
      .from("personnes")
      .select("*, profils_types(*)")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[getAllMembers] Query error:", error.message)
      return { data: null, error: error.message }
    }

    console.log(`[getAllMembers] Success - ${data?.length ?? 0} members`)
    return { data: data as PersonneWithRole[], error: null }
  } catch (err) {
    console.error("[getAllMembers] Exception:", err)
    return { data: null, error: "Erreur serveur" }
  }
}

export async function updateMemberRole(personneId: string, roleSlug: string) {
  try {
    const role = await getCallerRole()
    if (role !== "administrateur") {
      console.warn("[updateMemberRole] Unauthorized - not admin")
      return { success: false, error: "Seul un administrateur peut modifier les rôles." }
    }

    const admin = createAdminClient()

    const { data: profil, error: profilError } = await admin
      .from("profils_types")
      .select("id")
      .eq("slug", roleSlug)
      .single()

    if (profilError) {
      console.error("[updateMemberRole] Role not found:", roleSlug)
      return { success: false, error: "Rôle introuvable" }
    }

    const { error } = await admin
      .from("personnes")
      .update({ profil_type_id: profil.id })
      .eq("id", personneId)

    if (error) {
      console.error("[updateMemberRole] Update error:", error.message)
      return { success: false, error: error.message }
    }

    console.log(`[updateMemberRole] Success - ${personneId} → ${roleSlug}`)
    return { success: true, profil: { id: profil.id, slug: roleSlug } }
  } catch (err) {
    console.error("[updateMemberRole] Exception:", err)
    return { success: false, error: "Erreur serveur" }
  }
}

export async function getAllRoles() {
  try {
    console.log("[getAllRoles] Starting...")

    const admin = createAdminClient()
    const { data, error } = await admin
      .from("profils_types")
      .select("*")
      .order("nom")

    if (error) {
      console.error("[getAllRoles] Query error:", error.message)
      return { data: null, error: error.message }
    }

    console.log(`[getAllRoles] Success - ${data?.length ?? 0} roles`)
    return { data, error: null }
  } catch (err) {
    console.error("[getAllRoles] Exception:", err)
    return { data: null, error: "Erreur serveur" }
  }
}

export async function updateRolePermissions(roleId: string, permissions: Record<string, boolean>) {
  try {
    const role = await getCallerRole()
    if (role !== "administrateur") {
      console.warn("[updateRolePermissions] Unauthorized - not admin")
      return { success: false, error: "Non autorisé" }
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from("profils_types")
      .update({ permissions })
      .eq("id", roleId)

    if (error) {
      console.error("[updateRolePermissions] Update error:", error.message)
      return { success: false, error: error.message }
    }

    console.log(`[updateRolePermissions] Success - ${roleId}`)
    return { success: true }
  } catch (err) {
    console.error("[updateRolePermissions] Exception:", err)
    return { success: false, error: "Erreur serveur" }
  }
}
