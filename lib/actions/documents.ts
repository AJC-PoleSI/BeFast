"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export async function listTemplates() {
  const sb = createClient()
  const { data, error } = await sb
    .from("document_templates")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) return { error: error.message }
  return { data }
}

export async function deleteTemplate(id: string) {
  const sb = createClient()
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
  revalidatePath("/administration/documents")
  return { success: true }
}

export async function updateTemplateMeta(
  id: string,
  updates: Partial<{ name: string; description: string; category: string }>
) {
  const sb = createClient()
  const { error } = await sb.from("document_templates").update(updates).eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/administration/documents")
  return { success: true }
}

export async function listEntityDocuments(scope: string, entityId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from("generated_documents")
    .select("*, document_templates(id, name)")
    .eq("scope", scope)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
  if (error) return { error: error.message }
  return { data }
}

export async function deleteGeneratedDocument(id: string) {
  const sb = createClient()
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
 * List intervenants for a mission.
 * Combines: accepted candidatures + directly assigned intervenant (missions.intervenant_id).
 */
export async function listMissionIntervenants(missionId: string) {
  const sb = createClient()

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
  const { data } = await sb.from("parametres").select("key, value")
  const params: Record<string, string> = {}
  if (data) {
    for (const row of data) {
      params[row.key] = row.value || ""
    }
  }
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
  // Use admin client to bypass RLS — we need to read any user's profile
  const sb = createAdminClient()
  const today = new Date()

  // Load structure parameters in parallel with entity data
  const paramsPromise = loadStructureParams(sb)

  const base: Record<string, any> = {
    date: formatDateFR(today),
    today: today,
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
    const presidentParts = (params.president_nom || "").split(" ")
    const presidentGenre = params.president_genre || "M"
    
    const tresorierParts = (params.tresorier_nom || "").split(" ")
    const tresorierGenre = params.tresorier_genre || "M"

    return {
      president: {
        nom: presidentParts.length > 1 ? presidentParts.slice(1).join(" ") : presidentParts[0] || "",
        prenom: presidentParts.length > 1 ? presidentParts[0] : "",
        nom_complet: params.president_nom || "",
        genre: presidentGenre,
        civilite: presidentGenre === "F" ? "Madame" : "Monsieur",
        titre: presidentGenre === "F" ? "Madame" : "Monsieur",
      },
      tresorier: {
        nom: tresorierParts.length > 1 ? tresorierParts.slice(1).join(" ") : tresorierParts[0] || "",
        prenom: tresorierParts.length > 1 ? tresorierParts[0] : "",
        nom_complet: params.tresorier_nom || "",
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

  // Build étudiant/intervenant context from a personne record
  function buildIntervenantContext(person: any) {
    if (!person) return {}
    const ctx: Record<string, any> = {
      prenom: person.prenom || "",
      nom: person.nom || "",
      email: person.email || "",
      portable: person.portable || "",
      adresse: person.adresse || "",
      code_postal: person.code_postal || "",
      ville: person.ville || "",
      promo: person.promo || "",
      etablissement: person.etablissement || "",
      scolarite: person.scolarite || "",
      date_naissance: person.date_naissance || "",
    }
    return ctx
  }

  if (scope === "mission") {
    const [{ data: m }, params] = await Promise.all([
      sb
        .from("missions")
        .select(
          "*, intervenant:personnes!missions_intervenant_id_fkey(*), etudes(*, clients(*), suiveur:personnes!etudes_suiveur_id_fkey(id, prenom, nom, email), echeancier_blocs(*))"
        )
        .eq("id", entityId)
        .single(),
      paramsPromise,
    ])
    if (!m) return base
    
    const etude = (m as any).etudes ?? {}
    const { phases, nb_jeh, nb_phases, planning } = buildPhasesContext(etude.echeancier_blocs)
    
    const budget_ht = Number(etude.budget_ht) || 0
    const frais = Number(etude.frais_dossier) || 0
    const margePct = Number(etude.marge_pct) || 0
    const tarif = budget_ht + frais + budget_ht * (margePct / 100)

    // Resolve the intervenant: use explicit intervenantId if provided, else mission's intervenant
    let selectedIntervenant = (m as any).intervenant ?? {}
    if (intervenantId) {
      const { data: p } = await sb.from("personnes").select("*").eq("id", intervenantId).single()
      if (p) selectedIntervenant = p
    }

    const intervenantCtx = buildIntervenantContext(selectedIntervenant)
    const organigramme = buildOrganigramme(params)

    return {
      ...base,
      // Reference = numéro d'étude
      reference: etude.numero || "",
      // Mission
      mission: {
        ...m,
        numero_etude: etude.numero || "",
        description: m.description || "",
      },
      // Étude
      etude: {
        ...etude,
        prix: tarif.toFixed(2),
        frais: frais.toFixed(2),
        tarif_ht: tarif.toFixed(2),
        marge_euros: (budget_ht * (margePct / 100)).toFixed(2),
        nb_jeh,
        nb_phases,
      },
      // Client
      client: etude.clients ?? {},
      // Suiveur
      suiveur: etude.suiveur ?? {},
      // Intervenant (accessible via {intervenant.prenom})
      intervenant: intervenantCtx,
      // Étudiant = alias pour intervenant (accessible via {etudiant.prenom} ou {etudiant_prenom})
      etudiant: intervenantCtx,
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
    const [{ data: e }, params] = await Promise.all([
      sb
        .from("etudes")
        .select(
          "*, clients(*), suiveur:personnes!etudes_suiveur_id_fkey(id, prenom, nom, email), echeancier_blocs(*)"
        )
        .eq("id", entityId)
        .single(),
      paramsPromise,
    ])
    if (!e) return base
    const budget_ht = Number((e as any).budget_ht) || 0
    const frais = Number((e as any).frais_dossier) || 0
    const margePct = Number((e as any).marge_pct) || 0
    const tarif = budget_ht + frais + budget_ht * (margePct / 100)
    
    const { phases, nb_jeh, nb_phases, planning } = buildPhasesContext((e as any).echeancier_blocs)
    const organigramme = buildOrganigramme(params)

    return {
      ...base,
      reference: (e as any).numero || "",
      etude: {
        ...e,
        prix: tarif.toFixed(2),
        frais: frais.toFixed(2),
        tarif_ht: tarif.toFixed(2),
        marge_euros: (budget_ht * (margePct / 100)).toFixed(2),
        nb_jeh,
        nb_phases,
      },
      client: (e as any).clients ?? {},
      suiveur: (e as any).suiveur ?? {},
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
