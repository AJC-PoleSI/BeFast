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
import { getCachedProfile } from "@/lib/auth/cached-profile"
import { requireActionPermission } from "@/lib/auth/action-guards"
import { hasPermission, canEditEtude, canDeleteEtude } from "@/lib/auth/permissions"

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
  // Lecture des études : clé `etudes`. La RLS laisse lire toute étude
  // publiée (budget, marge, client compris) à n'importe quel compte, le garde
  // applicatif ferme cet écart pour les intervenants et comptes restreints.
  const acces = await requireActionPermission("etudes", "Vous n'avez pas accès aux études.")
  if (!acces.ok) return { error: acces.error }
  const supabase = createClient()

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
  // Lecture des études : clé `etudes`. La RLS laisse lire toute étude
  // publiée (budget, marge, client compris) à n'importe quel compte, le garde
  // applicatif ferme cet écart pour les intervenants et comptes restreints.
  const acces = await requireActionPermission("etudes", "Vous n'avez pas accès aux études.")
  if (!acces.ok) return { error: acces.error }
  const supabase = createClient()

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

// Identifiants des études qui concernent la personne connectée : créateur,
// suiveur (chef de projet) ou intervenant sur une de ses missions — même
// définition que le contrôle d'accès aux documents (lib/auth/document-access).
// Sert à épingler « Mes études » en haut de la page Études.
// Client admin : mission_collaborations et candidatures ne sont pas toutes
// lisibles en RLS ; chaque requête est filtrée sur l'utilisateur authentifié
// et ne renvoie que des identifiants d'études.
export async function getMesEtudeIds(): Promise<{ data?: string[]; error?: string }> {
  noStore()
  const acces = await requireActionPermission("etudes", "Vous n'avez pas accès aux études.")
  if (!acces.ok) return { error: acces.error }
  const uid = acces.userId
  const admin = createAdminClient()

  const [crees, suivies, multiSuivies, missionsDirectes, collabs, candidatures] = await Promise.all([
    admin.from("etudes").select("id").eq("created_by", uid),
    admin.from("etudes").select("id").eq("suiveur_id", uid),
    admin.from("etude_suiveurs").select("etude_id").eq("personne_id", uid),
    admin.from("missions").select("etude_id").eq("intervenant_id", uid),
    admin.from("mission_collaborations").select("mission_id").eq("intervenant_id", uid),
    admin.from("candidatures").select("mission_id").eq("personne_id", uid).eq("statut", "acceptee"),
  ])

  const ids = new Set<string>()
  const add = (id: string | null | undefined) => {
    if (id) ids.add(id)
  }
  for (const r of crees.data ?? []) add((r as { id: string }).id)
  for (const r of suivies.data ?? []) add((r as { id: string }).id)
  for (const r of multiSuivies.data ?? []) add((r as { etude_id: string | null }).etude_id)
  for (const r of missionsDirectes.data ?? []) add((r as { etude_id: string | null }).etude_id)

  const missionIds = [
    ...(collabs.data ?? []).map((r) => (r as { mission_id: string }).mission_id),
    ...(candidatures.data ?? []).map((r) => (r as { mission_id: string }).mission_id),
  ]
  if (missionIds.length) {
    const { data: viaMissions } = await admin
      .from("missions")
      .select("etude_id")
      .in("id", [...new Set(missionIds)])
    for (const r of viaMissions ?? []) add((r as { etude_id: string | null }).etude_id)
  }

  return { data: [...ids] }
}

// Détail d'une étude — PAS de cache pour garantir la fraîcheur des données
// après modification (les utilisateurs modifient fréquemment leurs études).
export async function getEtude(id: string) {
  noStore()
  // Lecture des études : clé `etudes`. La RLS laisse lire toute étude
  // publiée (budget, marge, client compris) à n'importe quel compte, le garde
  // applicatif ferme cet écart pour les intervenants et comptes restreints.
  const acces = await requireActionPermission("etudes", "Vous n'avez pas accès aux études.")
  if (!acces.ok) return { error: acces.error }
  const supabase = createClient()

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

// Colonnes que les formulaires peuvent écrire. Tout le reste (`published`,
// `created_by`, `suiveur_id`…) est posé par le serveur : un objet forgé ne
// doit pas pouvoir publier une étude ni en changer le créateur.
const COLONNES_ETUDE_FORMULAIRE = [
  "nom", "numero", "client_id", "budget", "budget_ht", "frais_dossier", "marge_pct", "type", "commentaire", "statut",
] as const
const COLONNES_CLIENT_FORMULAIRE = [
  "nom", "type", "secteur", "contact_civilite", "contact_prenom", "contact_nom", "contact_poste",
  "contact_email", "contact_phone", "adresse", "code_postal", "ville", "pays",
] as const
const COLONNES_BLOC_FORMULAIRE = ["nom", "semaine_debut", "duree_semaines", "jeh", "couleur", "ordre"] as const

function filtrerColonnes(obj: Record<string, unknown>, cles: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of cles) if (k in obj && obj[k] !== undefined) out[k] = obj[k]
  return out
}

/** Créateur + suiveurs d'une étude, pour canEditEtude. null si introuvable. */
async function chargerAccesEtude(supabase: ReturnType<typeof createClient>, etudeId: string) {
  const { data } = await supabase
    .from("etudes")
    .select("created_by, etude_suiveurs(personne_id)")
    .eq("id", etudeId)
    .single()
  if (!data) return null
  return {
    created_by: data.created_by,
    suiveurs: (data.etude_suiveurs ?? []).map((x: { personne_id: string }) => ({ id: x.personne_id })),
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
  // Création d'une étude : permission `nouvelle_mission`.
  const guard = await requireActionPermission(
    "nouvelle_mission",
    "Vous n'avez pas la permission de créer une étude."
  )
  if (!guard.ok) return { error: guard.error }

  const supabase = createClient()
  const user = { id: guard.userId }

  const { suiveur_ids, ...rest } = formData

  // Le créateur est suiveur (chef de projet) de son étude par défaut : sans
  // ça, il créait une étude sur laquelle il n'avait ensuite aucun droit dès
  // qu'il oubliait de se cocher dans la liste « Suiveur(s) ».
  const suiveursFinaux = Array.from(new Set([...(suiveur_ids ?? []), user.id]))

  console.log("[createEtude] Creating étude:", formData.numero, formData.nom)
  const { data, error } = await supabase
    .from("etudes")
    .insert({
      ...filtrerColonnes(rest, COLONNES_ETUDE_FORMULAIRE),
      suiveur_id: suiveursFinaux[0] ?? null,
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

  if (data && suiveursFinaux.length > 0) {
    const { error: suiveursError } = await supabase
      .from("etude_suiveurs")
      .insert(suiveursFinaux.map((personne_id) => ({ etude_id: data.id, personne_id })))
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

  // Les suiveurs sont chargés avec l'étude : ce sont les chefs de projet, ils
  // ont le droit de modifier l'étude qu'ils suivent (cf. canEditEtude).
  const { data: existing } = await supabase
    .from("etudes")
    .select("created_by, etude_suiveurs(personne_id)")
    .eq("id", id)
    .single()
  if (!existing) return { error: "Étude introuvable" }

  const profile = await getCachedProfile(user.id)
  const acces = {
    created_by: existing.created_by,
    suiveurs: (existing.etude_suiveurs ?? []).map((s: { personne_id: string }) => ({
      id: s.personne_id,
    })),
  }
  if (!canEditEtude(profile, acces)) {
    return { error: "Vous n'êtes pas autorisé à modifier cette étude." }
  }

  const { suiveur_ids, ...rest } = updates
  const payload: Record<string, unknown> = filtrerColonnes(rest, COLONNES_ETUDE_FORMULAIRE)
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
  // Annuaire (nom, contact) lu en client admin : réservé au formulaire d'étude
  // et à la prospection — pas aux 600 intervenants ni aux comptes restreints.
  const acces = await requireActionPermission(["etudes", "nouvelle_mission", "prospection"])
  if (!acces.ok) return { error: acces.error }
  return _getClientsCached()
}

export async function createClient_(formData: {
  nom: string
  type?: string
  secteur?: string
  contact_civilite?: string
  contact_prenom?: string
  contact_nom?: string
  contact_poste?: string
  contact_email?: string
  contact_phone?: string
  adresse?: string
  code_postal?: string
  ville?: string
  pays?: string
}) {
  const acces = await requireActionPermission(["nouvelle_mission", "administration", "prospection"])
  if (!acces.ok) return { error: acces.error }
  const supabase = createClient()
  if (!formData.nom?.trim()) return { error: "Le nom du client est requis." }

  const { data, error } = await supabase
    .from("clients")
    .insert(filtrerColonnes(formData, COLONNES_CLIENT_FORMULAIRE))
    .select()
    .single()

  if (error) return { error: error.message }
  revalidateTag(CLIENTS_TAG)
  return { data }
}

// Liste complète (tous les champs) — pour la page de gestion des clients.
// PAS de cache : cette page reste peu fréquentée, la fraîcheur prime.
export async function getClientsFull() {
  // Fiche complète des clients : même porte que la page Clients.
  const acces = await requireActionPermission(["administration", "prospection"])
  if (!acces.ok) return { error: acces.error }
  const supabase = createClient()

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("nom", { ascending: true })
  if (error) return { error: error.message }
  return { data }
}

export async function updateClient_(
  id: string,
  formData: Partial<{
    nom: string
    type: string
    secteur: string
    contact_civilite: string
    contact_prenom: string
    contact_nom: string
    contact_poste: string
    contact_email: string
    contact_phone: string
    adresse: string
    code_postal: string
    ville: string
    pays: string
    actif: boolean
  }>
) {
  const acces = await requireActionPermission(["administration", "prospection"])
  if (!acces.ok) return { error: acces.error }
  const supabase = createClient()
  if (formData.nom !== undefined && !formData.nom.trim()) {
    return { error: "Le nom du client est requis." }
  }

  const { data, error } = await supabase
    .from("clients")
    .update(filtrerColonnes(formData, [...COLONNES_CLIENT_FORMULAIRE, "actif"]))
    .eq("id", id)
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

  // Les blocs sont les lignes des conventions et des factures : seuls le
  // créateur, les suiveurs (chefs de projet) et `modifier_etudes` les
  // modifient — comme l'étude elle-même. L'étude de rattachement d'un bloc
  // existant est lue en base, jamais prise dans l'objet reçu.
  let etudeId = bloc.etude_id
  if (bloc.id) {
    const { data: existant } = await supabase.from("echeancier_blocs").select("etude_id").eq("id", bloc.id).single()
    if (!existant) return { error: "Bloc introuvable" }
    etudeId = existant.etude_id
  }
  const acces = await chargerAccesEtude(supabase, etudeId)
  if (!acces) return { error: "Étude introuvable" }
  const profile = await getCachedProfile(user.id)
  if (!canEditEtude(profile, acces)) return { error: "Vous n'êtes pas autorisé à modifier l'échéancier de cette étude." }

  const colonnes = filtrerColonnes(bloc as Record<string, unknown>, COLONNES_BLOC_FORMULAIRE)

  if (bloc.id) {
    const { data, error } = await supabase
      .from("echeancier_blocs")
      .update(colonnes)
      .eq("id", bloc.id)
      .select()
      .single()
    if (error) return { error: error.message }
    return { data }
  }

  const { data, error } = await supabase
    .from("echeancier_blocs")
    .insert({ ...colonnes, etude_id: etudeId })
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

  const profile = await getCachedProfile(user.id)
  if (!hasPermission(profile, "publier_etudes")) {
    return { error: "Vous n'êtes pas autorisé à publier ou dépublier une étude." }
  }

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

  const profile = await getCachedProfile(user.id)
  if (!hasPermission(profile, "publier_missions")) {
    return { error: "Vous n'êtes pas autorisé à publier ou dépublier une mission." }
  }

  // `.select()` : sans ligne renvoyée, la RLS a filtré l'UPDATE en silence —
  // on le signale plutôt que d'afficher un œil ouvert qui ne l'est pas en base.
  const { data, error } = await supabase
    .from("missions")
    .update({ published })
    .eq("id", id)
    .select("id, etude_id")
  if (error) return { error: error.message }
  if (!data || data.length === 0) {
    return { error: "Mission introuvable ou modification refusée." }
  }
  revalidatePath("/missions")
  revalidatePath(`/missions/${id}`)
  if (data[0].etude_id) revalidatePath(`/etudes/${data[0].etude_id}`)
  return { success: true }
}

export async function deleteEtude(id: string) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { data: existing } = await supabase.from("etudes").select("created_by").eq("id", id).single()
  if (!existing) return { error: "Étude introuvable" }

  const profile = await getCachedProfile(user.id)
  // Suppression : le suiveur en est exclu (cf. canDeleteEtude / migration 056).
  if (!canDeleteEtude(profile, existing)) {
    return { error: "Vous n'êtes pas autorisé à supprimer cette étude." }
  }

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

  const { data: existant } = await supabase.from("echeancier_blocs").select("etude_id").eq("id", id).single()
  if (!existant) return { error: "Bloc introuvable" }
  const acces = await chargerAccesEtude(supabase, existant.etude_id)
  if (!acces) return { error: "Étude introuvable" }
  const profile = await getCachedProfile(user.id)
  if (!canEditEtude(profile, acces)) return { error: "Vous n'êtes pas autorisé à modifier l'échéancier de cette étude." }

  const { error } = await supabase
    .from("echeancier_blocs")
    .delete()
    .eq("id", id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function getMembers() {
  const acces = await requireActionPermission(["etudes", "nouvelle_mission", "prospection"])
  if (!acces.ok) return { error: acces.error }
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
  const guard = await requireActionPermission(
    "parametres_structure",
    "Vous n'avez pas la permission de modifier les paramètres de la structure."
  )
  if (!guard.ok) return { error: guard.error }
  const supabase = createClient()

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
  const guard = await requireActionPermission(
    "parametres_structure",
    "Vous n'avez pas la permission de modifier les paramètres de la structure."
  )
  if (!guard.ok) return { error: guard.error }
  const supabase = createClient()

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
  // Écrit avec le client admin (contourne la RLS) : la permission applicative
  // est donc le seul contrôle — sans elle, n'importe quel compte connecté
  // pouvait réécrire la liste des pôles de la structure.
  const guard = await requireActionPermission(
    "parametres_structure",
    "Vous n'avez pas la permission de modifier les pôles."
  )
  if (!guard.ok) return { error: guard.error }

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
