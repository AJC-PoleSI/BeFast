"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath, revalidateTag, unstable_cache, unstable_noStore as noStore } from "next/cache"
import {
  CLIENTS_TAG,
  MEMBERS_TAG,
  PARAMETRES_TAG,
  ETUDES_TAG,
  ETUDE_DETAIL_TAG,
} from "@/lib/cache-tags"

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

// Cached members list (membres AJC actuels uniquement — exclut les
// intervenants externes et les anciens membres)
const _getMembersCached = unstable_cache(
  async () => {
    const sb = createAdminClient()

    const { data: excludedTypes } = await sb
      .from("profils_types")
      .select("id")
      .in("slug", ["intervenant", "ancien_membre_agc"])

    let query = sb
      .from("personnes")
      .select("id, prenom, nom, email")
      .eq("account_status", "validated")
      .order("nom", { ascending: true })

    const excludedIds = (excludedTypes ?? []).map((t) => t.id)
    if (excludedIds.length > 0) {
      query = query.not("profil_type_id", "in", `(${excludedIds.join(",")})`)
    }

    const { data, error } = await query
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

// DEBUG: Test query without JOINs to verify data exists
export async function getEtudesRaw(filters?: { statut?: string }) {
  noStore()
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  let query = supabase
    .from("etudes")
    .select("*")
    .order("created_at", { ascending: false })
  if (filters?.statut) query = query.eq("statut", filters.statut)
  const { data, error } = await query
  if (error) {
    console.error("[getEtudesRaw] Query error:", error)
    return { error: error.message }
  }
  return { data }
}

// Liste des études — PAS de cache. Les utilisateurs créent/modifient
// fréquemment et doivent toujours voir leur travail. La requête est rapide
// car SELECT est déjà optimisé (colonnes spécifiques).
export async function getEtudes(filters?: { statut?: string }) {
  noStore()
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  let query = supabase
    .from("etudes")
    .select(
      "*, clients(id, nom, type), suiveur:personnes!etudes_suiveur_id_fkey(id, prenom, nom, email), etude_suiveurs(personnes(id, prenom, nom, email))"
    )
    .order("created_at", { ascending: false })
  if (filters?.statut) query = query.eq("statut", filters.statut)
  const { data, error } = await query
  if (error) {
    console.error("[getEtudes] Query error:", error)
    return { error: error.message }
  }
  return { data: (data ?? []).map(withSuiveursList) }
}

// Détail d'une étude — PAS de cache pour garantir la fraîcheur des données
// après modification (les utilisateurs modifient fréquemment leurs études).
export async function getEtude(id: string) {
  noStore()
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { data, error } = await supabase
    .from("etudes")
    .select(
      "*, clients(id, nom, type), suiveur:personnes!etudes_suiveur_id_fkey(id, prenom, nom, email), etude_suiveurs(personnes(id, prenom, nom, email))"
    )
    .eq("id", id)
    .single()
  if (error) return { error: error.message }
  return { data: data ? withSuiveursList(data) : data }
}

// Aplati la jointure etude_suiveurs(personnes(...)) en un tableau `suiveurs`
// directement exploitable côté UI.
function withSuiveursList<T extends { etude_suiveurs?: { personnes: unknown }[] | null }>(
  etude: T
) {
  const { etude_suiveurs, ...rest } = etude
  return {
    ...rest,
    suiveurs: (etude_suiveurs ?? [])
      .map((es) => es.personnes)
      .filter(Boolean) as { id: string; prenom: string | null; nom: string | null; email: string | null }[],
  }
}

export async function createEtude(formData: {
  nom: string
  numero: string
  client_id?: string
  suiveur_ids?: string[]
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

  const { suiveur_ids, ...rest } = formData
  console.log("[createEtude] Creating étude:", formData.numero, formData.nom)
  const { data, error } = await supabase
    .from("etudes")
    .insert({
      ...rest,
      suiveur_id: suiveur_ids?.[0] ?? null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error("[createEtude] Insert error:", error.code, error.message)
    if (error.code === "23505") {
      return { error: "Ce numéro d'étude existe déjà." }
    }
    return { error: error.message }
  }

  if (data && suiveur_ids && suiveur_ids.length > 0) {
    const { error: suiveursError } = await supabase
      .from("etude_suiveurs")
      .insert(suiveur_ids.map((personne_id) => ({ etude_id: data.id, personne_id })))
    if (suiveursError) console.error("[createEtude] Suiveurs insert error:", suiveursError.message)
  }

  console.log("[createEtude] Created successfully, ID:", data?.id)
  revalidateTag(ETUDES_TAG)
  revalidatePath("/etudes")
  return { data }
}

export async function updateEtude(
  id: string,
  updates: Partial<{
    nom: string
    numero: string
    client_id: string
    suiveur_ids: string[]
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

  const { suiveur_ids, ...rest } = updates
  const payload: Record<string, unknown> = { ...rest }
  if (suiveur_ids !== undefined) payload.suiveur_id = suiveur_ids[0] ?? null

  const { error } = await supabase
    .from("etudes")
    .update(payload)
    .eq("id", id)

  if (error) return { error: error.message }

  if (suiveur_ids !== undefined) {
    const { error: delErr } = await supabase.from("etude_suiveurs").delete().eq("etude_id", id)
    if (delErr) return { error: delErr.message }
    if (suiveur_ids.length > 0) {
      const { error: insErr } = await supabase
        .from("etude_suiveurs")
        .insert(suiveur_ids.map((personne_id) => ({ etude_id: id, personne_id })))
      if (insErr) return { error: insErr.message }
    }
  }

  revalidateTag(ETUDES_TAG)
  revalidateTag(ETUDE_DETAIL_TAG(id))
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
  revalidateTag(ETUDES_TAG)
  revalidateTag(ETUDE_DETAIL_TAG(id))
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
  revalidateTag(ETUDES_TAG)
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
