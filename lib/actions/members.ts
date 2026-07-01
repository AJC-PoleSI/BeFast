"use server"

import { revalidateTag } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { PersonneWithRole, ProfilType, PersonnePoste } from "@/types/database.types"

async function getCallerRole(): Promise<string | null> {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return null

    const admin = createAdminClient()
    const { data, error } = await admin
      .from("personnes")
      .select("profils_types(slug)")
      .eq("id", user.id)
      .single()

    if (error) { console.error("[getCallerRole]", error.message); return null }
    return (data?.profils_types as any)?.slug ?? null
  } catch (err) {
    console.error("[getCallerRole] Exception:", err)
    return null
  }
}

export async function getAllMembers(): Promise<{ data: PersonneWithRole[] | null; error: string | null }> {
  try {
    const role = await getCallerRole()
    if (role !== "administrateur") return { data: null, error: "Non autorisé" }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from("personnes")
      .select("*, profils_types(*)")
      .order("created_at", { ascending: false })

    if (error) return { data: null, error: error.message }
    const members = (data ?? []) as PersonneWithRole[]

    // Postes par personne — requête séparée et tolérante (si la table
    // personne_postes n'existe pas encore, on renvoie les membres sans postes).
    try {
      const { data: links } = await admin
        .from("personne_postes")
        .select("personne_id, profils_types(id)")
      if (links) {
        const byPersonne = new Map<string, PersonnePoste[]>()
        for (const l of links as any[]) {
          const arr = byPersonne.get(l.personne_id) ?? []
          arr.push({ profils_types: l.profils_types } as unknown as PersonnePoste)
          byPersonne.set(l.personne_id, arr)
        }
        for (const m of members) m.personne_postes = byPersonne.get(m.id) ?? []
      }
    } catch {
      // Table absente : membres sans postes.
    }

    return { data: members, error: null }
  } catch (err) {
    console.error("[getAllMembers] Exception:", err)
    return { data: null, error: "Erreur serveur" }
  }
}

export async function updateMemberRole(personneId: string, roleSlug: string) {
  try {
    const role = await getCallerRole()
    if (role !== "administrateur") return { success: false, error: "Seul un administrateur peut modifier les rôles." }

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
  } catch (err) {
    console.error("[updateMemberRole] Exception:", err)
    return { success: false, error: "Erreur serveur" }
  }
}

export async function getAllRoles(): Promise<{ data: ProfilType[] | null; error: string | null }> {
  try {
    const client = createClient()
    const { data: { user } } = await client.auth.getUser()
    if (!user) return { data: null, error: "Non authentifié" }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from("profils_types")
      .select("*")
      .order("nom")

    if (error) return { data: null, error: error.message }
    return { data: data as ProfilType[], error: null }
  } catch (err) {
    console.error("[getAllRoles] Exception:", err)
    return { data: null, error: "Erreur serveur" }
  }
}

export async function updateRolePermissions(roleId: string, permissions: Record<string, boolean>) {
  try {
    const role = await getCallerRole()
    if (role !== "administrateur") return { success: false, error: "Non autorisé" }

    const admin = createAdminClient()
    const { error } = await admin
      .from("profils_types")
      .update({ permissions })
      .eq("id", roleId)

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    console.error("[updateRolePermissions] Exception:", err)
    return { success: false, error: "Erreur serveur" }
  }
}

export async function createRole(
  nom: string,
  slug: string,
  categorie: "base" | "bureau" | "pole" = "base"
) {
  try {
    const role = await getCallerRole()
    if (role !== "administrateur") return { success: false, error: "Non autorisé" }

    // Normalize slug
    const normalizedSlug = slug
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")

    const admin = createAdminClient()

    // Check slug uniqueness
    const { data: existing } = await admin
      .from("profils_types")
      .select("id")
      .eq("slug", normalizedSlug)
      .single()

    if (existing) return { success: false, error: "Un rôle avec ce slug existe déjà." }

    const emptyPerms = {
      dashboard: false, profil: false, missions: false, etudes: false,
      prospection: false, statistiques: false, administration: false,
      membres: false, documents: false, nouvelle_mission: false,
      selectionner_candidats: false, valider_comptes: false,
      voir_documents_membres: false, voir_factures: false,
      valider_bv: false, assigner_intervenants: false,
      parametres_structure: false, gerer_parametres: false,
      publier_etudes: false, publier_missions: false,
      signer_documents: false, signer_ba: false,
    }

    const { data, error } = await admin
      .from("profils_types")
      .insert({ nom, slug: normalizedSlug, permissions: emptyPerms, est_defaut: false, categorie })
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as ProfilType }
  } catch (err) {
    console.error("[createRole] Exception:", err)
    return { success: false, error: "Erreur serveur" }
  }
}

export async function deleteRole(roleId: string) {
  try {
    const role = await getCallerRole()
    if (role !== "administrateur") return { success: false, error: "Non autorisé" }

    const admin = createAdminClient()

    // Prevent deleting administrateur
    const { data: target } = await admin
      .from("profils_types")
      .select("slug")
      .eq("id", roleId)
      .single()

    if (target?.slug === "administrateur") {
      return { success: false, error: "Impossible de supprimer le rôle Administrateur." }
    }

    // Count affected users
    const { count } = await admin
      .from("personnes")
      .select("id", { count: "exact", head: true })
      .eq("profil_type_id", roleId)

    // Remove profil_type from affected users first
    if (count && count > 0) {
      await admin
        .from("personnes")
        .update({ profil_type_id: null })
        .eq("profil_type_id", roleId)
    }

    const { error } = await admin
      .from("profils_types")
      .delete()
      .eq("id", roleId)

    if (error) return { success: false, error: error.message }
    return { success: true, affectedUsers: count ?? 0 }
  } catch (err) {
    console.error("[deleteRole] Exception:", err)
    return { success: false, error: "Erreur serveur" }
  }
}

/** Liste des postes assignables (bureau + pôles). */
export async function getPostesCatalog(): Promise<{ data: ProfilType[] | null; error: string | null }> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("profils_types")
      .select("*")
      .in("categorie", ["bureau", "pole"])
      .order("categorie")
      .order("nom")
    if (error) return { data: null, error: error.message }
    return { data: data as ProfilType[], error: null }
  } catch (err) {
    console.error("[getPostesCatalog] Exception:", err)
    return { data: null, error: "Erreur serveur" }
  }
}

/** Remplace l'ensemble des postes d'une personne (admin uniquement). */
export async function setPersonnePostes(personneId: string, posteIds: string[]) {
  try {
    const role = await getCallerRole()
    if (role !== "administrateur") return { success: false, error: "Non autorisé" }

    const admin = createAdminClient()

    // Ne garder que des ids réellement bureau/pole (anti-injection).
    let validIds: string[] = []
    if (posteIds.length) {
      const { data: valid } = await admin
        .from("profils_types")
        .select("id")
        .in("id", posteIds)
        .in("categorie", ["bureau", "pole"])
      validIds = (valid ?? []).map((r: { id: string }) => r.id)
    }

    // Remplacement complet des postes de la personne.
    await admin.from("personne_postes").delete().eq("personne_id", personneId)
    if (validIds.length) {
      const rows = validIds.map((poste_id) => ({ personne_id: personneId, poste_id }))
      const { error } = await admin.from("personne_postes").insert(rows)
      if (error) return { success: false, error: error.message }
    }

    // Invalide le profil en cache pour recalculer les permissions effectives.
    revalidateTag(`user-profile:${personneId}`)
    return { success: true }
  } catch (err) {
    console.error("[setPersonnePostes] Exception:", err)
    return { success: false, error: "Erreur serveur" }
  }
}
