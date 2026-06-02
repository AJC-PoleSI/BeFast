"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import type { ParametresMap, MargesMap } from "@/lib/proposals-constants"

export type { ParametresMap, MargesMap }

// Lecture de tous les paramètres globaux (clé -> valeur).
// Accessible à tout membre authentifié (RLS public read).
export async function getParametres(): Promise<{ data: ParametresMap | null; error: string | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: "Non authentifié" }

  const { data, error } = await supabase.from("parametres").select("key, value")
  if (error) return { data: null, error: error.message }

  const map: ParametresMap = {}
  for (const row of data ?? []) map[row.key] = row.value
  return { data: map, error: null }
}

// Écriture en lot des paramètres — administrateur uniquement.
export async function saveParametres(values: ParametresMap): Promise<{ success: boolean; error?: string }> {
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
    return { success: false, error: "Seul un administrateur peut modifier les paramètres." }
  }

  const rows = Object.entries(values).map(([key, value]) => ({
    key,
    value: value ?? "",
    updated_at: new Date().toISOString(),
  }))
  const { error } = await admin.from("parametres").upsert(rows)
  if (error) return { success: false, error: error.message }

  revalidatePath("/administration/controle-donnees")
  return { success: true }
}

// ---- Marges recommandées par taille d'entreprise ----

// Map taille -> marge_pct. Accessible à tout membre authentifié.
export async function getMargesRecommandees(): Promise<{ data: MargesMap | null; error: string | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: "Non authentifié" }

  const { data, error } = await supabase.from("marges_recommandees").select("taille_entreprise, marge_pct")
  if (error) return { data: null, error: error.message }

  const map: MargesMap = {}
  for (const row of data ?? []) map[row.taille_entreprise] = Number(row.marge_pct)
  return { data: map, error: null }
}

// Écriture en lot des marges — administrateur uniquement.
export async function saveMargesRecommandees(values: MargesMap): Promise<{ success: boolean; error?: string }> {
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
    return { success: false, error: "Seul un administrateur peut modifier les marges." }
  }

  const rows = Object.entries(values).map(([taille_entreprise, marge_pct]) => ({
    taille_entreprise,
    marge_pct: Number(marge_pct) || 0,
    updated_at: new Date().toISOString(),
  }))
  const { error } = await admin.from("marges_recommandees").upsert(rows)
  if (error) return { success: false, error: error.message }

  revalidatePath("/administration/controle-donnees")
  return { success: true }
}
