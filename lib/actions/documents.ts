"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath, revalidateTag, unstable_cache, unstable_noStore as noStore } from "next/cache"

const TEMPLATES_TAG = "document_templates"

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

  return _listTemplatesCached()
}

export async function deleteTemplate(id: string) {
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

  const { data, error } = await sb
    .from("generated_documents")
    .select("*, document_templates(id, name)")
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
      .select("*, document_templates(id, name)")
      .eq("scope", "etude")
      .eq("entity_id", etudeId)
      .then((r: any) => r),
  ]
  if (missionIds.length > 0) {
    queries.push(
      sb
        .from("generated_documents")
        .select("*, document_templates(id, name)")
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

// ============================================================
// Helper: load all structure parameters from the parametres table
// ============================================================
async function loadStructureParams(sb: ReturnType<typeof createAdminClient>) {
  const { data, error } = await sb.from("parametres").select("key, value")
  console.log("[DOC-GEN] loadStructureParams error:", error?.message || "none")
  const params: Record<string, string> = {}
  if (data) {
    for (const row of data) {
      params[row.key] = row.value || ""
    }
  }
  console.log("[DOC-GEN] loadStructureParams keys loaded:", Object.keys(params))
  console.log("[DOC-GEN] president_nom:", params.president_nom)
  console.log("[DOC-GEN] president_genre:", params.president_genre)
  console.log("[DOC-GEN] tresorier_nom:", params.tresorier_nom)
  console.log("[DOC-GEN] raison_sociale:", params.raison_sociale)
  return params
}

// ============================================================
// Helper: format a date to DD/MM/YYYY
// ============================================================
function formatDateFR(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0")
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const yyyy = String(date.getFullYear())
  return `${dd}/${mm}/${yyyy}`
}

// Format an ISO date string (YYYY-MM-DD) or Date into DD/MM/YYYY.
// Returns "" for null/undefined/empty/invalid inputs.
function fmtDate(value: any): string {
  if (!value) return ""
  const d = value instanceof Date ? value : new Date(value)
  if (isNaN(d.getTime())) return ""
  return formatDateFR(d)
}

/**
 * Construit un contexte complet pour le remplissage des templates DOCX.
 * 
 * Placeholders supportés :
 * - {date}, {today}, {annee}, {date_iso}
 * - {etude.*} — toutes les colonnes de l'étude
 * - {mission.*} — toutes les colonnes de la mission
 * - {client.*} — toutes les colonnes du client
 * - {suiveur.*} — le suiveur de l'étude
 * - {intervenant.*} — l'intervenant sélectionné
 * - {etudiant.*}, {etudiant_*} — alias pour l'intervenant
 * - {president.*} — le/la président(e) de la JE (depuis parametres)
 * - {tresorier.*} — le/la trésorier(e)
 * - {reference} — le numéro d'étude
 * - {phases}, {planning}, {nb_jeh}, {nb_phases}
 */
export async function buildTemplateContext(
  scope: "etude" | "mission" | "personne" | "general",
  entityId: string,
  intervenantId?: string
): Promise<Record<string, any>> {
  const client = createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  // Use admin client to bypass RLS — we need to read any user's profile
  const sb = createAdminClient()
  const today = new Date()

  // Load structure parameters in parallel with entity data
  const paramsPromise = loadStructureParams(sb)

  const base: Record<string, any> = {
    date: formatDateFR(today),
    today: formatDateFR(today),
    date_iso: today.toISOString().slice(0, 10),
    annee: String(today.getFullYear()),
  }

  function buildPhasesContext(blocs: any[] | undefined) {
    if (!blocs || !Array.isArray(blocs)) return { phases: [], nb_jeh: 0, nb_phases: 0, planning: "" }
    
    const sortedBlocs = [...blocs].sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || a.semaine_debut - b.semaine_debut)
    
    let totalJeh = 0
    const phases = sortedBlocs.map((b, i) => {
      const jeh = Number(b.nombre_jeh) || Number(b.jeh) || 0
      totalJeh += jeh
      return {
        numero: i + 1,
        lettre: String.fromCharCode(65 + i),
        nom: b.nom || "",
        description: b.description || "",
        prix_jeh: Number(b.prix_jeh) || 0,
        nombre_jeh: jeh,
        semaine_debut: b.semaine_debut,
        semaine_fin: b.semaine_debut + (b.duree_semaines || 1) - 1,
      }
    })

    let rowsXml = ""
    for (const p of phases) {
      rowsXml += `
        <w:tr>
          <w:tc><w:p><w:r><w:t>${p.numero} - ${p.nom}</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>S${p.semaine_debut} à S${p.semaine_fin}</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>${p.nombre_jeh} JEH</w:t></w:r></w:p></w:tc>
        </w:tr>
      `
    }
    const planning = `
      <w:tbl>
        <w:tblPr>
          <w:tblStyle w:val="TableGrid"/>
          <w:tblW w:w="5000" w:type="pct"/>
          <w:tblBorders>
            <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
            <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
            <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
            <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
            <w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>
            <w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          </w:tblBorders>
        </w:tblPr>
        ${rowsXml}
      </w:tbl>
    `

    return { phases, nb_jeh: totalJeh, nb_phases: phases.length, planning }
  }

  // Build president/tresorier objects from parametres
  function buildOrganigramme(params: Record<string, string>) {
    // Parse president_nom which may be "Prénom Nom" or just "Nom"
    const presidentNomRaw = params.president_nom || ""
    const presidentParts = presidentNomRaw.trim().split(/\s+/).filter(Boolean)
    const presidentGenre = params.president_genre || "M"

    const tresorierNomRaw = params.tresorier_nom || ""
    const tresorierParts = tresorierNomRaw.trim().split(/\s+/).filter(Boolean)
    const tresorierGenre = params.tresorier_genre || "M"

    console.log("[DOC-GEN] buildOrganigramme president_nom_raw:", presidentNomRaw)
    console.log("[DOC-GEN] buildOrganigramme president_parts:", presidentParts)
    console.log("[DOC-GEN] buildOrganigramme tresorier_nom_raw:", tresorierNomRaw)
    console.log("[DOC-GEN] buildOrganigramme tresorier_parts:", tresorierParts)

    return {
      president: {
        nom: presidentParts.length > 1 ? presidentParts.slice(1).join(" ") : presidentParts[0] || "",
        prenom: presidentParts.length > 1 ? presidentParts[0] : "",
        nom_complet: presidentNomRaw,
        genre: presidentGenre,
        civilite: presidentGenre === "F" ? "Madame" : "Monsieur",
        titre: presidentGenre === "F" ? "Madame" : "Monsieur",
      },
      tresorier: {
        nom: tresorierParts.length > 1 ? tresorierParts.slice(1).join(" ") : tresorierParts[0] || "",
        prenom: tresorierParts.length > 1 ? tresorierParts[0] : "",
        nom_complet: tresorierNomRaw,
        genre: tresorierGenre,
        civilite: tresorierGenre === "F" ? "Madame" : "Monsieur",
        titre: tresorierGenre === "F" ? "Madame" : "Monsieur",
      },
      structure: {
        raison_sociale: params.raison_sociale || "",
        siret: params.siret || "",
        code_ape: params.code_ape || "",
        numero_tva: params.numero_tva || "",
        numero_urssaf: params.numero_urssaf || "",
        adresse: [params.adresse_1, params.adresse_2].filter(Boolean).join(", "),
        adresse_1: params.adresse_1 || "",
        adresse_2: params.adresse_2 || "",
        code_postal: params.code_postal || "",
        ville: params.ville || "",
        telephone: params.telephone || "",
        email: params.email_contact || "",
        site_web: params.site_web || "",
        iban: params.iban || "",
        bic: params.bic || "",
        nom_ecole: params.nom_ecole || "",
      },
    }
  }

  // Build étudiant/intervenant context from a personne record.
  // Only extract primitive fields — skip nested Supabase join objects.
  function buildIntervenantContext(person: any) {
    console.log("[DOC-GEN] buildIntervenantContext input:", person ? "object" : "null/undefined")
    if (!person) {
      console.log("[DOC-GEN] buildIntervenantContext: person is null/undefined, returning empty object")
      return {}
    }
    if (Object.keys(person).length === 0) {
      console.log("[DOC-GEN] buildIntervenantContext: person is empty object")
      return {}
    }
    console.log("[DOC-GEN] buildIntervenantContext input keys:", Object.keys(person))
    const ctx: Record<string, any> = {}
    for (const [k, v] of Object.entries(person)) {
      if (v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) continue
      ctx[k] = v ?? ""
    }
    console.log("[DOC-GEN] buildIntervenantContext output keys:", Object.keys(ctx))
    console.log("[DOC-GEN] buildIntervenantContext prenom:", ctx.prenom || "(empty)")
    console.log("[DOC-GEN] buildIntervenantContext nom:", ctx.nom || "(empty)")
    console.log("[DOC-GEN] buildIntervenantContext output:", JSON.stringify(ctx).slice(0, 200))
    return ctx
  }

  if (scope === "mission") {
    console.log("[DOC-GEN-V2] ===== MISSION SCOPE (V2 — independent queries) =====")
    console.log("[DOC-GEN-V2] missionId:", entityId, "intervenantId:", intervenantId)

    // Step 1: Fetch mission alone (no joins — most reliable)
    const [{ data: m, error: mErr }, params] = await Promise.all([
      sb.from("missions").select("*").eq("id", entityId).single(),
      paramsPromise,
    ])
    console.log("[DOC-GEN-V2] Mission fetch error:", mErr?.message || "none")
    if (mErr || !m) {
      console.log("[DOC-GEN-V2] Mission failed:", JSON.stringify(mErr))
      return base
    }
    console.log("[DOC-GEN-V2] Mission OK:", m.nom, "etude_id:", m.etude_id, "intervenant_id:", m.intervenant_id)

    // Step 2: Fetch related data IN PARALLEL via separate queries
    const [etudeRes, intervenantRes, blocsRes] = await Promise.all([
      // Etude (if mission has etude_id)
      m.etude_id
        ? sb.from("etudes").select("*").eq("id", m.etude_id).single()
        : Promise.resolve({ data: null, error: null }),
      // Intervenant: use explicit ID if provided, else mission.intervenant_id
      (intervenantId || m.intervenant_id)
        ? sb.from("personnes").select("*").eq("id", intervenantId || m.intervenant_id).single()
        : Promise.resolve({ data: null, error: null }),
      // Phases (echeancier_blocs) — only if mission has etude_id
      m.etude_id
        ? sb.from("echeancier_blocs").select("*").eq("etude_id", m.etude_id)
        : Promise.resolve({ data: [], error: null }),
    ])

    const etude: any = (etudeRes as any).data || {}
    const selectedIntervenant: any = (intervenantRes as any).data
    const blocs: any[] = (blocsRes as any).data || []

    console.log("[DOC-GEN-V2] Etude:", etude?.numero || "(empty)", "err:", (etudeRes as any).error?.message || "")
    console.log("[DOC-GEN-V2] Intervenant:", selectedIntervenant ? `${selectedIntervenant.prenom} ${selectedIntervenant.nom}` : "(none)", "err:", (intervenantRes as any).error?.message || "")
    console.log("[DOC-GEN-V2] Blocs count:", blocs.length)

    // Step 3: Fetch client and suiveur for the etude (in parallel)
    const [clientRes, suiveurRes] = await Promise.all([
      etude.client_id
        ? sb.from("clients").select("*").eq("id", etude.client_id).single()
        : Promise.resolve({ data: null, error: null }),
      etude.suiveur_id
        ? sb.from("personnes").select("id, prenom, nom, email").eq("id", etude.suiveur_id).single()
        : Promise.resolve({ data: null, error: null }),
    ])

    const clientData: any = (clientRes as any).data || {}
    const suiveur: any = (suiveurRes as any).data || {}
    console.log("[DOC-GEN-V2] Client:", clientData?.nom || "(empty)", "err:", (clientRes as any).error?.message || "")
    console.log("[DOC-GEN-V2] Suiveur:", suiveur?.nom || "(empty)", "err:", (suiveurRes as any).error?.message || "")

    const { phases, nb_jeh, nb_phases, planning } = buildPhasesContext(blocs)

    const budget_ht = Number(etude.budget_ht) || 0
    const frais = Number(etude.frais_dossier) || 0
    const margePct = Number(etude.marge_pct) || 0
    const tarif = budget_ht + frais + budget_ht * (margePct / 100)

    const intervenantCtx = buildIntervenantContext(selectedIntervenant)
    console.log("[DOC-GEN-V2] intervenantCtx:", JSON.stringify(intervenantCtx).slice(0, 300))

    const organigramme = buildOrganigramme(params)
    console.log("[DOC-GEN-V2] organigramme.president:", JSON.stringify(organigramme.president).slice(0, 200))

    // Extract only primitive fields from mission
    const missionPrimitives: Record<string, any> = {}
    for (const [k, v] of Object.entries(m as Record<string, any>)) {
      if (v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) continue
      missionPrimitives[k] = v ?? ""
    }
    console.log("[DOC-GEN-V2] mission primitive keys:", Object.keys(missionPrimitives))

    return {
      ...base,
      // Reference = numéro d'étude
      reference: etude.numero || "",
      // Mission — only primitive fields + formatted dates
      mission: {
        ...missionPrimitives,
        date_debut: fmtDate(m.date_debut),
        date_fin: fmtDate(m.date_fin),
        date_debut_iso: m.date_debut || "",
        date_fin_iso: m.date_fin || "",
        numero_etude: (etude.numero || "").slice(-2),
        numero_etude_complet: etude.numero || "",
      },
      // Étude — dates formatted DD/MM/YYYY
      etude: {
        ...etude,
        date_debut: fmtDate(etude.date_debut),
        date_fin: fmtDate(etude.date_fin),
        date_debut_iso: etude.date_debut || "",
        date_fin_iso: etude.date_fin || "",
        prix: tarif.toFixed(2),
        frais: frais.toFixed(2),
        tarif_ht: tarif.toFixed(2),
        marge_euros: (budget_ht * (margePct / 100)).toFixed(2),
        nb_jeh,
        nb_phases,
      },
      // Flat aliases for convenience (top-level)
      date_debut: fmtDate(etude.date_debut),
      date_fin: fmtDate(etude.date_fin),
      // Client (extract first from array if needed)
      client: clientData,
      // Suiveur (fetched independently)
      suiveur,
      // Intervenant (accessible via {intervenant.prenom})
      intervenant: intervenantCtx,
      // Étudiant = alias pour intervenant ({etudiant.*}, {étudiant.*} avec accent, {etudiant_*})
      etudiant: intervenantCtx,
      "étudiant": intervenantCtx,
      etudiant_prenom: intervenantCtx.prenom,
      etudiant_nom: intervenantCtx.nom,
      etudiant_adresse: intervenantCtx.adresse,
      etudiant_code_postal: intervenantCtx.code_postal,
      etudiant_ville: intervenantCtx.ville,
      // Organigramme (président, trésorier, structure)
      ...organigramme,
      // Phases & planning
      phases,
      planning,
      nb_jeh,
      nb_phases,
    }
  }

  if (scope === "etude") {
    console.log("[DOC-GEN-V2] ===== ETUDE SCOPE (V2 — independent queries) =====")
    console.log("[DOC-GEN-V2] etudeId:", entityId, "intervenantId:", intervenantId)

    // Step 1: Fetch etude alone (no joins)
    const [{ data: e, error: eErr }, params] = await Promise.all([
      sb.from("etudes").select("*").eq("id", entityId).single(),
      paramsPromise,
    ])
    if (eErr || !e) {
      console.log("[DOC-GEN-V2] Etude failed:", JSON.stringify(eErr))
      return base
    }
    const eAny = e as any
    console.log("[DOC-GEN-V2] Etude OK:", eAny.numero, "client_id:", eAny.client_id, "suiveur_id:", eAny.suiveur_id)

    // Step 2: Fetch client, suiveur, blocs, intervenant in PARALLEL
    const [clientRes, suiveurRes, blocsRes, intervenantRes] = await Promise.all([
      eAny.client_id
        ? sb.from("clients").select("*").eq("id", eAny.client_id).single()
        : Promise.resolve({ data: null, error: null }),
      eAny.suiveur_id
        ? sb.from("personnes").select("id, prenom, nom, email").eq("id", eAny.suiveur_id).single()
        : Promise.resolve({ data: null, error: null }),
      sb.from("echeancier_blocs").select("*").eq("etude_id", entityId),
      intervenantId
        ? sb.from("personnes").select("*").eq("id", intervenantId).single()
        : Promise.resolve({ data: null, error: null }),
    ])

    const clientData: any = (clientRes as any).data || {}
    const suiveur: any = (suiveurRes as any).data || {}
    const blocs: any[] = (blocsRes as any).data || []
    const selectedIntervenant: any = (intervenantRes as any).data
    console.log("[DOC-GEN-V2] Client:", clientData?.nom || "(empty)", "err:", (clientRes as any).error?.message || "")
    console.log("[DOC-GEN-V2] Suiveur:", suiveur?.nom || "(empty)", "err:", (suiveurRes as any).error?.message || "")
    console.log("[DOC-GEN-V2] Blocs count:", blocs.length)
    console.log("[DOC-GEN-V2] Intervenant (étude scope):", selectedIntervenant ? `${selectedIntervenant.prenom} ${selectedIntervenant.nom}` : "(none)")

    const budget_ht = Number(eAny.budget_ht) || 0
    const frais = Number(eAny.frais_dossier) || 0
    const margePct = Number(eAny.marge_pct) || 0
    const tarif = budget_ht + frais + budget_ht * (margePct / 100)

    const { phases, nb_jeh, nb_phases, planning } = buildPhasesContext(blocs)
    const organigramme = buildOrganigramme(params)
    const intervenantCtx = buildIntervenantContext(selectedIntervenant)

    return {
      ...base,
      reference: eAny.numero || "",
      etude: {
        ...e,
        date_debut: fmtDate(eAny.date_debut),
        date_fin: fmtDate(eAny.date_fin),
        date_debut_iso: eAny.date_debut || "",
        date_fin_iso: eAny.date_fin || "",
        prix: tarif.toFixed(2),
        frais: frais.toFixed(2),
        tarif_ht: tarif.toFixed(2),
        marge_euros: (budget_ht * (margePct / 100)).toFixed(2),
        nb_jeh,
        nb_phases,
      },
      date_debut: fmtDate(eAny.date_debut),
      date_fin: fmtDate(eAny.date_fin),
      client: clientData,
      suiveur,
      intervenant: intervenantCtx,
      etudiant: intervenantCtx,
      "étudiant": intervenantCtx,
      etudiant_prenom: intervenantCtx.prenom,
      etudiant_nom: intervenantCtx.nom,
      etudiant_adresse: intervenantCtx.adresse,
      etudiant_code_postal: intervenantCtx.code_postal,
      etudiant_ville: intervenantCtx.ville,
      ...organigramme,
      phases,
      planning,
      nb_jeh,
      nb_phases,
    }
  }

  if (scope === "personne") {
    const [{ data: p }, params] = await Promise.all([
      sb.from("personnes").select("*").eq("id", entityId).single(),
      paramsPromise,
    ])
    const intervenantCtx = buildIntervenantContext(p)
    const organigramme = buildOrganigramme(params)
    return {
      ...base,
      personne: p ?? {},
      etudiant: intervenantCtx,
      "étudiant": intervenantCtx,
      etudiant_prenom: intervenantCtx.prenom,
      etudiant_nom: intervenantCtx.nom,
      ...organigramme,
    }
  }

  // general scope
  const params = await paramsPromise
  const organigramme = buildOrganigramme(params)
  return { ...base, ...organigramme }
}
