"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath, revalidateTag, unstable_cache, unstable_noStore as noStore } from "next/cache"
import { getCachedProfile } from "@/lib/auth/cached-profile"
import { requireActionPermission } from "@/lib/auth/action-guards"
import { canAccessEntityDocuments, isMembreInterne } from "@/lib/auth/document-access"

const TEMPLATES_TAG = "document_templates"

// Listes de documents générés : l'intervenant concerné est affiché à côté du
// document (il n'apparaît pas dans le nom du fichier).
const GENERATED_DOCS_SELECT =
  "*, document_templates(id, name), intervenant:personnes!generated_documents_intervenant_id_fkey(id, prenom, nom)"

// Uses admin client (no cookies) so unstable_cache works across requests.
// Templates are global admin resources — bypassing RLS is safe here.
const _listTemplatesCached = unstable_cache(
  async () => {
    const sb = createAdminClient()
    const { data, error } = await sb
      .from("document_templates")
      .select("id, name, description, category, file_path, file_name, placeholders, created_at")
      .order("created_at", { ascending: false })
    if (error) return { error: error.message }
    return { data }
  },
  [TEMPLATES_TAG],
  { tags: [TEMPLATES_TAG], revalidate: 3600 }
)

export async function listTemplates() {
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { error: "Non authentifié" }
  const profile = await getCachedProfile(user.id)
  if (!isMembreInterne(profile)) return { error: "Non autorisé" }

  return _listTemplatesCached()
}

export async function deleteTemplate(id: string) {
  // Modèles de documents : réservé à l'administration / au paramétrage avancé
  // (la RLS de `document_templates` laisse passer les membres internes).
  const guard = await requireActionPermission(
    ["administration", "gerer_parametres"],
    "Vous n'avez pas la permission de gérer les modèles de documents."
  )
  if (!guard.ok) return { error: guard.error }

  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { data: tpl } = await sb
    .from("document_templates")
    .select("file_path")
    .eq("id", id)
    .single()
  if (tpl?.file_path) {
    await sb.storage.from("templates").remove([tpl.file_path])
  }
  const { error } = await sb.from("document_templates").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidateTag(TEMPLATES_TAG)
  revalidatePath("/administration/documents")
  return { success: true }
}

export async function updateTemplateMeta(
  id: string,
  updates: Partial<{ name: string; description: string; category: string }>
) {
  // Modèles de documents : réservé à l'administration / au paramétrage avancé
  // (la RLS de `document_templates` laisse passer les membres internes).
  const guard = await requireActionPermission(
    ["administration", "gerer_parametres"],
    "Vous n'avez pas la permission de gérer les modèles de documents."
  )
  if (!guard.ok) return { error: guard.error }

  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { error } = await sb.from("document_templates").update(updates).eq("id", id)
  if (error) return { error: error.message }
  revalidateTag(TEMPLATES_TAG)
  revalidatePath("/administration/documents")
  return { success: true }
}

export async function listEntityDocuments(scope: string, entityId: string) {
  noStore()
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { error: "Non authentifié" }
  const profile = await getCachedProfile(user.id)
  if (!(await canAccessEntityDocuments(profile, scope, entityId))) {
    return { error: "Non autorisé" }
  }

  const { data, error } = await sb
    .from("generated_documents")
    .select(GENERATED_DOCS_SELECT)
    .eq("scope", scope)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
  if (error) return { error: error.message }
  return { data }
}

/**
 * List all documents related to an étude:
 * - documents directly scoped to the étude
 * - documents scoped to missions belonging to this étude
 */
export async function listEtudeAllDocuments(etudeId: string) {
  noStore()
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { error: "Non authentifié" }
  const profile = await getCachedProfile(user.id)
  if (!(await canAccessEntityDocuments(profile, "etude", etudeId))) {
    return { error: "Non autorisé" }
  }

  // Get mission IDs for this étude
  const { data: missions } = await sb
    .from("missions")
    .select("id")
    .eq("etude_id", etudeId)
  const missionIds = (missions || []).map((m: any) => m.id)

  // Fetch étude-scoped + mission-scoped docs in parallel
  const queries: any[] = [
    sb
      .from("generated_documents")
      .select(GENERATED_DOCS_SELECT)
      .eq("scope", "etude")
      .eq("entity_id", etudeId)
      .then((r: any) => r),
  ]
  if (missionIds.length > 0) {
    queries.push(
      sb
        .from("generated_documents")
        .select(GENERATED_DOCS_SELECT)
        .eq("scope", "mission")
        .in("entity_id", missionIds)
        .then((r: any) => r)
    )
  }

  const results = await Promise.all(queries)
  const all: any[] = []
  for (const r of results) {
    if (r.data) all.push(...r.data)
  }
  all.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
  return { data: all }
}

export async function deleteGeneratedDocument(id: string) {
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { error: "Non authentifié" }
  const profile = await getCachedProfile(user.id)
  // Suppression d'un document officiel : réservée aux membres internes
  // (un intervenant peut consulter ses documents mais pas les effacer).
  if (!isMembreInterne(profile)) return { error: "Non autorisé" }

  const { data: doc } = await sb
    .from("generated_documents")
    .select("file_path, scope, entity_id")
    .eq("id", id)
    .single()
  if (doc?.file_path) {
    await sb.storage.from("documents").remove([doc.file_path])
  }
  const { error } = await sb.from("generated_documents").delete().eq("id", id)
  if (error) return { error: error.message }
  if (doc) {
    revalidatePath(`/${doc.scope === "mission" ? "missions" : "etudes"}/${doc.entity_id}/documents`)
  }
  return { success: true }
}

/**
 * List missions for an étude (for the mission/intervenant selector on étude documents page).
 */
export async function listEtudeMissions(etudeId: string) {
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { data, error } = await sb
    .from("missions")
    .select("id, nom, type, statut, intervenant_id, intervenant:personnes!missions_intervenant_id_fkey(id, prenom, nom)")
    .eq("etude_id", etudeId)
    .order("created_at", { ascending: true })
  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

/**
 * List intervenants for a mission.
 * Combines: accepted candidatures + directly assigned intervenant (missions.intervenant_id).
 */
export async function listMissionIntervenants(missionId: string) {
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const [candidaturesRes, missionRes] = await Promise.all([
    sb
      .from("candidatures")
      .select("personne_id, personnes!candidatures_personne_id_fkey(id, prenom, nom, email)")
      .eq("mission_id", missionId)
      .eq("statut", "acceptee"),
    sb
      .from("missions")
      .select("intervenant_id, intervenant:personnes!missions_intervenant_id_fkey(id, prenom, nom, email)")
      .eq("id", missionId)
      .single(),
  ])

  const seen = new Set<string>()
  const intervenants: any[] = []

  for (const c of candidaturesRes.data || []) {
    const p = (c as any).personnes
    if (p && !seen.has(p.id)) {
      seen.add(p.id)
      intervenants.push(p)
    }
  }

  const directIntervenant = (missionRes.data as any)?.intervenant
  if (directIntervenant && !seen.has(directIntervenant.id)) {
    intervenants.push(directIntervenant)
  }

  return { data: intervenants }
}

// La construction du contexte des modèles ({etude.*}, {intervenant.*}…) vit
// dans lib/documents/context.ts (module server-only, pas une action).
