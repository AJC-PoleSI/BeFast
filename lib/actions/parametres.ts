"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache"
import { PARAMETRES_TAG, MARGES_TAG } from "@/lib/cache-tags"
import type { ParametresMap, MargesMap } from "@/lib/proposals-constants"

export type { ParametresMap, MargesMap }

// Lecture des paramètres mise en cache (données publiques, invalidée sur écriture).
// Évite une requête DB à chaque navigation → pages plus fluides, charge serveur réduite.
const _readParametres = unstable_cache(
  async (): Promise<ParametresMap> => {
    const admin = createAdminClient()
    const { data } = await admin.from("parametres").select("key, value")
    const map: ParametresMap = {}
    for (const row of data ?? []) map[row.key] = row.value
    return map
  },
  ["parametres-all"],
  { tags: [PARAMETRES_TAG] }
)

// Lecture de tous les paramètres globaux (clé -> valeur).
// Accessible à tout membre authentifié (RLS public read).
export async function getParametres(): Promise<{ data: ParametresMap | null; error: string | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: "Non authentifié" }

  try {
    return { data: await _readParametres(), error: null }
  } catch (e: any) {
    return { data: null, error: e?.message ?? "Erreur de lecture des paramètres" }
  }
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

  revalidateTag(PARAMETRES_TAG)
  return { success: true }
}

// ---- Marges recommandées par taille d'entreprise ----

const _readMarges = unstable_cache(
  async (): Promise<MargesMap> => {
    const admin = createAdminClient()
    const { data } = await admin.from("marges_recommandees").select("taille_entreprise, marge_pct")
    const map: MargesMap = {}
    for (const row of data ?? []) map[row.taille_entreprise] = Number(row.marge_pct)
    return map
  },
  ["marges-all"],
  { tags: [MARGES_TAG] }
)

// Map taille -> marge_pct. Accessible à tout membre authentifié.
export async function getMargesRecommandees(): Promise<{ data: MargesMap | null; error: string | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: "Non authentifié" }

  try {
    return { data: await _readMarges(), error: null }
  } catch (e: any) {
    return { data: null, error: e?.message ?? "Erreur de lecture des marges" }
  }
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

  revalidateTag(MARGES_TAG)
  return { success: true }
}
