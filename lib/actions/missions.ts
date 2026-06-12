"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath, revalidateTag, unstable_cache, unstable_noStore as noStore } from "next/cache"
import { MISSIONS_TAG, MISSION_DETAIL_TAG, CANDIDATURES_TAG } from "@/lib/cache-tags"
import { sendEmail } from "@/lib/email/send"
import { missionAssignedEmail } from "@/lib/email/templates"

// Liste des missions — PAS de cache. Les utilisateurs créent/modifient
// fréquemment leurs missions et doivent toujours voir leur travail.
export async function getMissions(filters?: {
  type?: string
  voie?: string
  classe?: string
  statut?: string
}) {
  noStore()
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  let query = supabase
    .from("missions")
    .select("id, nom, description, type, voie, classe, statut, nb_jeh, nb_intervenants, remuneration, etude_id, created_at, etudes(id, nom, numero, published)")
    .neq("type", "chef_projet")
    .order("created_at", { ascending: false })

  if (filters?.type && filters.type !== "chef_projet") query = query.eq("type", filters.type)
  if (filters?.voie) query = query.eq("voie", filters.voie)
  if (filters?.classe) query = query.eq("classe", filters.classe)
  if (filters?.statut) query = query.eq("statut", filters.statut)

  const { data, error } = await query
  if (error) return { error: error.message }
  const filtered = (data ?? []).filter((m: any) => m.etudes?.published === true)
  return { data: filtered }
}

// Détail d'une mission — PAS de cache pour garantir la fraîcheur après modification.
export async function getMission(id: string) {
  noStore()
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

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

  revalidateTag(MISSIONS_TAG)
  revalidatePath("/missions")
  if (formData.etude_id) revalidatePath(`/etudes/${formData.etude_id}`)
  return { data }
}

export async function updateMissionStatut(id: string, statut: string) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { error } = await supabase
    .from("missions")
    .update({ statut })
    .eq("id", id)

  if (error) return { error: error.message }
  revalidateTag(MISSIONS_TAG)
  revalidateTag(MISSION_DETAIL_TAG(id))
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
  revalidateTag(`candidatures:${user.id}`)
  revalidatePath(`/missions/${formData.mission_id}`)
  return { data }
}

// PAS de cache — les candidatures changent fréquemment et l'utilisateur
// doit toujours voir leur état réel.
export async function getMesCandidatures() {
  noStore()
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
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

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
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  // Get candidature owner so we can invalidate their cache
  const { data: cand } = await supabase
    .from("candidatures")
    .select("personne_id, personnes!candidatures_personne_id_fkey(prenom, email)")
    .eq("id", candidatureId)
    .single()

  const { error } = await supabase
    .from("candidatures")
    .update({ statut, reponse_date: new Date().toISOString() })
    .eq("id", candidatureId)

  if (error) return { error: error.message }
  if (cand?.personne_id) revalidateTag(CANDIDATURES_TAG(cand.personne_id))
  revalidatePath("/missions")

  // Notification best-effort au candidat retenu.
  if (statut === "acceptee") {
    const personne = cand?.personnes as { prenom?: string | null; email?: string | null } | null
    if (personne?.email) {
      const tpl = missionAssignedEmail(personne.prenom ?? null)
      await sendEmail({ to: personne.email, subject: tpl.subject, html: tpl.html })
    }
  }

  return { success: true }
}
