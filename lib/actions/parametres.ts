"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export type ParametresMap = Record<string, string>

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
