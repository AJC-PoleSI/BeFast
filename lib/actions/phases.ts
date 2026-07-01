"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidateTag, unstable_cache } from "next/cache"
import { PHASES_TAG } from "@/lib/cache-tags"

export type PhaseDefaut = {
  id: number
  nom: string
  objectifs: string | null
  methodologie: string | null
  contraintes: string | null
  jeh_defaut: number
  intervenants_defaut: number
  duree_semaines: number
  archived: boolean
}

// --- Droits de l'appelant (admin / super-admin) ---
async function getCaller() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, isAdmin: false, isSuper: false }
  const admin = createAdminClient()
  const { data } = await admin
    .from("personnes")
    .select("is_super_admin, profils_types!profil_type_id(slug)")
    .eq("id", user.id)
    .single()
  const isAdmin = (data?.profils_types as any)?.slug === "administrateur"
  return { user, isAdmin, isSuper: isAdmin && !!(data as any)?.is_super_admin }
}

export async function getMyPhasePermissions() {
  const { isAdmin, isSuper } = await getCaller()
  return { isAdmin, isSuper }
}

// --- Lecture (cache, données publiques) ---
const _readPhases = unstable_cache(
  async (includeArchived: boolean): Promise<PhaseDefaut[]> => {
    const admin = createAdminClient()
    let q = admin
      .from("phases_defaut")
      .select("id, nom, objectifs, methodologie, contraintes, jeh_defaut, intervenants_defaut, duree_semaines, archived")
      .order("id", { ascending: true })
    if (!includeArchived) q = q.eq("archived", false)
    const { data } = await q
    return (data ?? []) as PhaseDefaut[]
  },
  ["phases-defaut"],
  { tags: [PHASES_TAG] }
)

export async function getPhasesDefaut(includeArchived = false): Promise<{ data: PhaseDefaut[] | null; error: string | null }> {
  const { user } = await getCaller()
  if (!user) return { data: null, error: "Non authentifié" }
  try {
    return { data: await _readPhases(includeArchived), error: null }
  } catch (e: any) {
    return { data: null, error: e?.message ?? "Erreur de lecture des phases" }
  }
}

// --- Écriture (admin) ---
export async function savePhaseDefaut(phase: Omit<PhaseDefaut, "archived">): Promise<{ success: boolean; error?: string }> {
  const { isAdmin } = await getCaller()
  if (!isAdmin) return { success: false, error: "Seul un administrateur peut modifier les phases." }

  const admin = createAdminClient()
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
  revalidateTag(PHASES_TAG)
  return { success: true }
}

// Crée une phase vierge (id = max+1). Admin.
export async function createPhaseDefaut(): Promise<{ data?: PhaseDefaut; error?: string }> {
  const { isAdmin } = await getCaller()
  if (!isAdmin) return { error: "Seul un administrateur peut créer une phase." }
  const admin = createAdminClient()
  const { data: maxRow } = await admin.from("phases_defaut").select("id").order("id", { ascending: false }).limit(1).maybeSingle()
  const nextId = ((maxRow?.id as number) ?? 0) + 1
  const { data, error } = await admin
    .from("phases_defaut")
    .insert({ id: nextId, nom: "Nouvelle phase", jeh_defaut: 100, intervenants_defaut: 3, duree_semaines: 2, source: "manuel" })
    .select("id, nom, objectifs, methodologie, contraintes, jeh_defaut, intervenants_defaut, duree_semaines, archived")
    .single()
  if (error) return { error: error.message }
  revalidateTag(PHASES_TAG)
  return { data: data as PhaseDefaut }
}

// Archive / désarchive — SUPER-ADMIN uniquement (action sensible).
export async function setPhaseArchived(id: number, archived: boolean): Promise<{ success: boolean; error?: string }> {
  const { user, isSuper } = await getCaller()
  if (!isSuper) return { success: false, error: "Réservé au super-administrateur." }
  const admin = createAdminClient()
  const { error } = await admin
    .from("phases_defaut")
    .update({ archived, archived_at: archived ? new Date().toISOString() : null, archived_by: archived ? user!.id : null })
    .eq("id", id)
  if (error) return { success: false, error: error.message }
  revalidateTag(PHASES_TAG)
  return { success: true }
}

// --- Prix net moyen PAR phase (sur études signées) ---
// net = prix_jeh / (1 + marge_pct/100). prix_jeh est déjà HT (TVA hors JEH).
export async function getPrixNetMoyenParPhase(): Promise<{ data: Record<string, number>; error: string | null }> {
  const { user } = await getCaller()
  if (!user) return { data: {}, error: "Non authentifié" }
  const admin = createAdminClient()
  const { data, error } = await admin.from("budget_etude").select("phase, prix_jeh, marge_pct")
  if (error) return { data: {}, error: error.message }
  const acc: Record<string, { sum: number; n: number }> = {}
  for (const r of data ?? []) {
    const prix = Number((r as any).prix_jeh) || 0
    const marge = Number((r as any).marge_pct) || 0
    if (prix <= 0) continue
    const net = prix / (1 + marge / 100)
    const key = (r as any).phase as string
    if (!acc[key]) acc[key] = { sum: 0, n: 0 }
    acc[key].sum += net
    acc[key].n += 1
  }
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(acc)) out[k] = Math.round((v.sum / v.n) * 100) / 100
  return { data: out, error: null }
}

// --- Statistiques de pilotage ---
export async function getPhasesStats(): Promise<{
  data: { nbPhasesActives: number; nbPhasesArchivees: number; nbPropales: number; nbCeSignees: number; tauxConversion: number; phasePlusUtilisee: string | null }
  error: string | null
}> {
  const { user } = await getCaller()
  const empty = { nbPhasesActives: 0, nbPhasesArchivees: 0, nbPropales: 0, nbCeSignees: 0, tauxConversion: 0, phasePlusUtilisee: null }
  if (!user) return { data: empty, error: "Non authentifié" }
  const admin = createAdminClient()

  const [phasesRes, propsRes, phaseNamesRes] = await Promise.all([
    admin.from("phases_defaut").select("archived"),
    admin.from("proposals").select("status"),
    admin.from("proposal_phases").select("name"),
  ])

  const phases = phasesRes.data ?? []
  const nbPhasesActives = phases.filter((p: any) => !p.archived).length
  const nbPhasesArchivees = phases.filter((p: any) => p.archived).length

  const props = propsRes.data ?? []
  const nbPropales = props.length
  const nbCeSignees = props.filter((p: any) => p.status === "CE signée").length
  const tauxConversion = nbPropales > 0 ? Math.round((nbCeSignees / nbPropales) * 100) : 0

  const freq: Record<string, number> = {}
  for (const r of phaseNamesRes.data ?? []) {
    const n = (r as any).name as string
    if (n) freq[n] = (freq[n] ?? 0) + 1
  }
  const phasePlusUtilisee = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return { data: { nbPhasesActives, nbPhasesArchivees, nbPropales, nbCeSignees, tauxConversion, phasePlusUtilisee }, error: null }
}

// --- Phases suggérées (détectées dans les propales, absentes du catalogue) ---
export async function getSuggestedPhases(): Promise<{ data: string[]; error: string | null }> {
  const { user } = await getCaller()
  if (!user) return { data: [], error: "Non authentifié" }
  const admin = createAdminClient()
  const [catRes, usedRes] = await Promise.all([
    admin.from("phases_defaut").select("nom"),
    admin.from("proposal_phases").select("name"),
  ])
  const known = new Set((catRes.data ?? []).map((r: any) => (r.nom ?? "").trim().toLowerCase()))
  const seen = new Set<string>()
  const out: string[] = []
  for (const r of usedRes.data ?? []) {
    const name = ((r as any).name ?? "").trim()
    const key = name.toLowerCase()
    if (!name || known.has(key) || seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return { data: out, error: null }
}

// Intègre une phase suggérée au catalogue (source='auto'). Admin.
export async function integrateSuggestedPhase(nom: string): Promise<{ success: boolean; error?: string }> {
  const { isAdmin } = await getCaller()
  if (!isAdmin) return { success: false, error: "Seul un administrateur peut intégrer une phase." }
  const admin = createAdminClient()
  const { data: maxRow } = await admin.from("phases_defaut").select("id").order("id", { ascending: false }).limit(1).maybeSingle()
  const nextId = ((maxRow?.id as number) ?? 0) + 1
  const { error } = await admin
    .from("phases_defaut")
    .insert({ id: nextId, nom, jeh_defaut: 100, intervenants_defaut: 3, duree_semaines: 2, source: "auto" })
  if (error) return { success: false, error: error.message }
  revalidateTag(PHASES_TAG)
  return { success: true }
}
