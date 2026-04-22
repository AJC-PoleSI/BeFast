"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getMissions(filters?: {
  type?: string
  voie?: string
  classe?: string
  statut?: string
}) {
  const supabase = createClient()
  let query = supabase
    .from("missions")
    .select("*, etudes(id, nom, numero, published)")
    // Les missions "chef_projet" (suivi de projet) ne sont jamais listées côté intervenant
    .neq("type", "chef_projet")
    .order("created_at", { ascending: false })

  if (filters?.type && filters.type !== "chef_projet") query = query.eq("type", filters.type)
  if (filters?.voie) query = query.eq("voie", filters.voie)
  if (filters?.classe) query = query.eq("classe", filters.classe)
  if (filters?.statut) query = query.eq("statut", filters.statut)

  const { data, error } = await query
  if (error) {
    console.error("getMissions error:", error)
    return { error: error.message }
  }

  // La visibilité d'une mission dépend uniquement de son étude parente.
  // Si l'étude est publiée → ses missions le sont. Sinon → aucune.
  const filtered = (data ?? []).filter((m: any) => {
    if (!m.etudes) return false
    return m.etudes.published === true
  })

  return { data: filtered }
}

export async function getMission(id: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("missions")
    .select("*, etudes(id, nom, numero)")
    .eq("id", id)
    .single()

  if (error) return { error: error.message }
  return { data }
}

export async function createMission(formData: {
  etude_id?: string
  nom: string
  description?: string
  type: string
  voie?: string
  classe?: string
  langues?: string[]
  date_debut?: string
  date_fin?: string
  remuneration?: number
  nb_jeh?: number
  nb_intervenants?: number
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "Non authentifié" }

  const { data, error } = await supabase
    .from("missions")
    .insert({
      ...formData,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // Auto-create un bloc dans l'échéancier pour la mission
  if (data && formData.etude_id) {
    // Trouver la semaine max déjà utilisée pour placer le nouveau bloc à la suite
    const { data: existingBlocs } = await supabase
      .from("echeancier_blocs")
      .select("semaine_debut, duree_semaines")
      .eq("etude_id", formData.etude_id)
    const maxSemaine = (existingBlocs ?? []).reduce(
      (max, b) => Math.max(max, (b.semaine_debut ?? 1) + (b.duree_semaines ?? 1) - 1),
      0
    )
    const jehTotal = (formData.nb_jeh ?? 0) * (formData.nb_intervenants ?? 1)
    await supabase.from("echeancier_blocs").insert({
      etude_id: formData.etude_id,
      mission_id: data.id,
      nom: formData.nom,
      semaine_debut: maxSemaine + 1,
      duree_semaines: Math.max(1, Math.ceil(jehTotal / 5)), // ~5 JEH/semaine par défaut
      jeh: jehTotal || null,
      couleur: "#00236f",
    })
  }

  revalidatePath("/missions")
  if (formData.etude_id) revalidatePath(`/etudes/${formData.etude_id}`)
  return { data }
}

export async function updateMissionStatut(id: string, statut: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from("missions")
    .update({ statut })
    .eq("id", id)

  if (error) return { error: error.message }
  revalidatePath("/missions")
  return { success: true }
}

// ---- Candidatures ----

export async function candidaterMission(formData: {
  mission_id: string
  motivation: string
  classe?: string
  langues?: { langue: string; niveau: string }[]
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "Non authentifié" }

  const { data, error } = await supabase
    .from("candidatures")
    .insert({
      mission_id: formData.mission_id,
      personne_id: user.id,
      motivation: formData.motivation,
      classe: formData.classe ? formData.classe.toLowerCase() : null,
      langues: formData.langues || [],
    })
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return { error: "Vous avez déjà candidaté à cette mission." }
    }
    return { error: error.message }
  }
  revalidatePath(`/missions/${formData.mission_id}`)
  return { data }
}

export async function getMesCandidatures() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "Non authentifié" }

  const { data, error } = await supabase
    .from("candidatures")
    .select("*, missions(id, nom, statut)")
    .eq("personne_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return { error: error.message }
  return { data }
}

export async function getCandidaturesMission(missionId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("candidatures")
    .select("*, personnes!candidatures_personne_id_fkey(id, prenom, nom, email)")
    .eq("mission_id", missionId)
    .order("created_at", { ascending: true })

  if (error) return { error: error.message }
  return { data }
}

export async function repondreCandidature(
  candidatureId: string,
  statut: "acceptee" | "refusee"
) {
  const supabase = createClient()
  const { error } = await supabase
    .from("candidatures")
    .update({ statut, reponse_date: new Date().toISOString() })
    .eq("id", candidatureId)

  if (error) return { error: error.message }
  revalidatePath("/missions")
  return { success: true }
}
