"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getEtudes(filters?: { statut?: string }) {
  const supabase = createClient()
  let query = supabase
    .from("etudes")
    .select(
      "*, clients(id, nom, type), suiveur:personnes!etudes_suiveur_id_fkey(id, prenom, nom, email)"
    )
    .order("created_at", { ascending: false })

  if (filters?.statut) query = query.eq("statut", filters.statut)

  const { data, error } = await query
  if (error) return { error: error.message }
  return { data }
}

export async function getEtude(id: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("etudes")
    .select(
      "*, clients(id, nom, type), suiveur:personnes!etudes_suiveur_id_fkey(id, prenom, nom, email)"
    )
    .eq("id", id)
    .single()

  if (error) return { error: error.message }
  return { data }
}

export async function createEtude(formData: {
  nom: string
  numero: string
  client_id?: string
  suiveur_id?: string
  budget?: number
  budget_ht?: number
  type?: string
  commentaire?: string
  statut?: string
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "Non authentifié" }

  const { data, error } = await supabase
    .from("etudes")
    .insert({
      ...formData,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return { error: "Ce numéro d'étude existe déjà." }
    }
    return { error: error.message }
  }
  revalidatePath("/etudes")
  return { data }
}

export async function updateEtude(
  id: string,
  updates: Partial<{
    nom: string
    numero: string
    client_id: string
    suiveur_id: string
    budget: number
    commentaire: string
    statut: string
  }>
) {
  const supabase = createClient()
  const { error } = await supabase
    .from("etudes")
    .update(updates)
    .eq("id", id)

  if (error) return { error: error.message }
  revalidatePath("/etudes")
  revalidatePath(`/etudes/${id}`)
  return { success: true }
}

export async function getEtudeMissions(etudeId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("missions")
    .select("*")
    .eq("etude_id", etudeId)
    .order("created_at", { ascending: true })

  if (error) return { error: error.message }
  return { data }
}

// ---- Clients ----

export async function getClients() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("nom", { ascending: true })

  if (error) return { error: error.message }
  return { data }
}

export async function createClient_(formData: {
  nom: string
  email?: string
  telephone?: string
  type: string
  notes?: string
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "Non authentifié" }

  const { data, error } = await supabase
    .from("clients")
    .insert({ ...formData, created_by: user.id })
    .select()
    .single()

  if (error) return { error: error.message }
  return { data }
}

// ---- Échéancier ----

export async function getEcheancierBlocs(etudeId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("echeancier_blocs")
    .select("*")
    .eq("etude_id", etudeId)
    .order("ordre", { ascending: true })

  if (error) return { error: error.message }
  return { data }
}

export async function upsertEcheancierBloc(bloc: {
  id?: string
  etude_id: string
  nom: string
  semaine_debut: number
  duree_semaines: number
  jeh?: number
  couleur?: string
  ordre?: number
}) {
  const supabase = createClient()

  if (bloc.id) {
    const { data, error } = await supabase
      .from("echeancier_blocs")
      .update(bloc)
      .eq("id", bloc.id)
      .select()
      .single()
    if (error) return { error: error.message }
    return { data }
  }

  const { data, error } = await supabase
    .from("echeancier_blocs")
    .insert(bloc)
    .select()
    .single()

  if (error) return { error: error.message }
  return { data }
}

export async function deleteEcheancierBloc(id: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from("echeancier_blocs")
    .delete()
    .eq("id", id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function getMembers() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("personnes")
    .select("id, prenom, nom, email, profils_types!inner(slug)")
    .eq("profils_types.slug", "chef_projet_ajc")
    .eq("actif", true)
    .order("nom", { ascending: true })

  if (error) return { error: error.message }
  const members = (data ?? []).map(({ id, prenom, nom, email }) => ({ id, prenom, nom, email }))
  return { data: members }
}

export async function getParametre(key: string) {
  const supabase = createClient()
  const { data } = await supabase.from("parametres").select("value").eq("key", key).single()
  return data?.value ?? null
}

export async function setParametre(key: string, value: string) {
  const supabase = createClient()
  const { error } = await supabase.from("parametres").upsert({ key, value }).eq("key", key)
  if (error) return { error: error.message }
  revalidatePath("/administration")
  return { success: true }
}
