"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export type PhaseDefaut = {
  id: number
  nom: string
  objectifs: string | null
  methodologie: string | null
  contraintes: string | null
  jeh_defaut: number
  intervenants_defaut: number
  duree_semaines: number
}

// Lecture des phases par défaut (table phases_defaut). Tout membre authentifié.
export async function getPhasesDefaut(): Promise<{ data: PhaseDefaut[] | null; error: string | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: "Non authentifié" }

  const { data, error } = await supabase
    .from("phases_defaut")
    .select("id, nom, objectifs, methodologie, contraintes, jeh_defaut, intervenants_defaut, duree_semaines")
    .order("id", { ascending: true })
  if (error) return { data: null, error: error.message }
  return { data: data as PhaseDefaut[], error: null }
}

// Mise à jour d'une phase par défaut — administrateur uniquement.
export async function savePhaseDefaut(phase: PhaseDefaut): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Non authentifié" }

  const admin = createAdminClient()
  const { data: caller } = await admin
    .from("personnes")
    .select("profils_types(slug)")
    .eq("id", user.id)
    .single()
  if ((caller?.profils_types as any)?.slug !== "administrateur") {
    return { success: false, error: "Seul un administrateur peut modifier les phases." }
  }

  const { error } = await admin.from("phases_defaut").upsert({
    id: phase.id,
    nom: phase.nom,
    objectifs: phase.objectifs,
    methodologie: phase.methodologie,
    contraintes: phase.contraintes,
    jeh_defaut: Number(phase.jeh_defaut) || 0,
    intervenants_defaut: Number(phase.intervenants_defaut) || 0,
    duree_semaines: Number(phase.duree_semaines) || 1,
    updated_at: new Date().toISOString(),
  })
  if (error) return { success: false, error: error.message }

  revalidatePath("/prospection/phases")
  return { success: true }
}

// Prix JEH "brut" moyen (hors marge) calculé sur les budgets d'étude réels.
export async function getPrixJehBrutMoyen(): Promise<{ data: number | null; error: string | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: "Non authentifié" }

  const { data, error } = await supabase.from("budget_etude").select("prix_jeh")
  if (error) return { data: null, error: error.message }
  const prices = (data ?? []).map((r: any) => Number(r.prix_jeh)).filter((n) => n > 0)
  if (prices.length === 0) return { data: null, error: null }
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length
  return { data: Math.round(avg * 100) / 100, error: null }
}
