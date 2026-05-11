"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath, revalidateTag, unstable_cache, unstable_noStore as noStore } from "next/cache"

// Cache tags — used to invalidate cached queries on mutations
const CLIENTS_TAG = "clients"
const MEMBERS_TAG = "members"
const PARAMETRES_TAG = "parametres"
const ETUDES_TAG = "etudes"

// Cached version of getClients — clients rarely change.
// Uses admin client (bypasses RLS) so unstable_cache works across requests.
const _getClientsCached = unstable_cache(
  async () => {
    const sb = createAdminClient()
    const { data, error } = await sb
      .from("clients")
      .select("id, nom, type, contact_nom, contact_email, contact_phone, actif")
      .order("nom", { ascending: true })
    if (error) return { error: error.message }
    return { data }
  },
  [CLIENTS_TAG],
  { tags: [CLIENTS_TAG], revalidate: 600 }
)

// Cached members list (validated personnes only)
const _getMembersCached = unstable_cache(
  async () => {
    const sb = createAdminClient()
    const { data, error } = await sb
      .from("personnes")
      .select("id, prenom, nom, email")
      .eq("account_status", "validated")
      .order("nom", { ascending: true })
    if (error) return { error: error.message }
    return { data }
  },
  [MEMBERS_TAG],
  { tags: [MEMBERS_TAG], revalidate: 600 }
)

// Cached parametres (key/value map) — change rarely
const _getAllParametresCached = unstable_cache(
  async () => {
    const sb = createAdminClient()
    const { data, error } = await sb
      .from("parametres")
      .select("key, value, description")
      .order("key")
    if (error) return { error: error.message }
    const map: Record<string, string> = {}
    for (const p of data ?? []) map[p.key] = p.value ?? ""
    return { data: map, list: data ?? [] }
  },
  [PARAMETRES_TAG],
  { tags: [PARAMETRES_TAG], revalidate: 1800 }
)

export async function getEtudes(filters?: { statut?: string }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  // Liste optimisée — ne pas tirer toutes les colonnes (perf).
  // Le détail (getEtude) fait un SELECT complet sur demande.
  let query = supabase
    .from("etudes")
    .select(
      "id, nom, numero, statut, type, budget, budget_ht, frais_dossier, marge_pct, commentaire, client_id, suiveur_id, published, created_at, clients(id, nom, type), suiveur:personnes!etudes_suiveur_id_fkey(id, prenom, nom, email)"
    )
    .order("created_at", { ascending: false })

  if (filters?.statut) query = query.eq("statut", filters.statut)

  const { data, error } = await query
  if (error) return { error: error.message }
  return { data }
}

export async function getEtude(id: string) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

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
  frais_dossier?: number
  marge_pct?: number
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
    budget_ht: number
    frais_dossier: number
    marge_pct: number
    type: string
    commentaire: string
    statut: string
  }>
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

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
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

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
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }
  return _getClientsCached()
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
  revalidateTag(CLIENTS_TAG)
  return { data }
}

// ---- Échéancier ----

export async function getEcheancierBlocs(etudeId: string) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

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
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

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

export async function toggleEtudePublished(id: string, published: boolean) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { error } = await supabase.from("etudes").update({ published }).eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/etudes")
  revalidatePath(`/etudes/${id}`)
  return { success: true }
}

export async function toggleMissionPublished(id: string, published: boolean) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { error } = await supabase.from("missions").update({ published }).eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/missions")
  return { success: true }
}

export async function deleteEtude(id: string) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { error } = await supabase.from("etudes").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/etudes")
  return { success: true }
}

export async function deleteEcheancierBloc(id: string) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { error } = await supabase
    .from("echeancier_blocs")
    .delete()
    .eq("id", id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function getMembers() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }
  return _getMembersCached()
}

export async function getParametre(key: string) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { data } = await supabase.from("parametres").select("value").eq("key", key).single()
  return data?.value ?? null
}

export async function setParametre(key: string, value: string) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { error } = await supabase.from("parametres").upsert({ key, value }, { onConflict: "key" })
  if (error) return { error: error.message }
  revalidateTag(PARAMETRES_TAG)
  revalidatePath("/administration")
  return { success: true }
}

export async function getAllParametres() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }
  return _getAllParametresCached()
}

export async function setParametres(updates: Record<string, string>) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const rows = Object.entries(updates).map(([key, value]) => ({ key, value }))
  const { error } = await supabase.from("parametres").upsert(rows, { onConflict: "key" })
  if (error) return { error: error.message }
  revalidateTag(PARAMETRES_TAG)
  revalidatePath("/administration")
  revalidatePath("/administration/structure")
  return { success: true }
}

/**
 * Save poles without triggering revalidatePath.
 * Uses admin client to bypass RLS on the parametres table.
 * revalidatePath causes the client component to remount,
 * which resets state and re-fetches data — creating a loop
 * that overwrites the user's changes.
 */
export async function savePolesSilent(polesJson: string, permsJson: string) {
  const client = createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const supabase = createAdminClient()
  const rows = [
    { key: "poles_liste", value: polesJson },
    { key: "pole_permissions", value: permsJson },
  ]
  console.log("[POLES] Saving poles:", polesJson.slice(0, 200))
  const { error } = await supabase.from("parametres").upsert(rows, { onConflict: "key" })
  if (error) {
    console.log("[POLES] ERROR:", error.message)
    return { error: error.message }
  }
  console.log("[POLES] Saved successfully")
  // NO revalidatePath here — intentional
  return { success: true }
}
