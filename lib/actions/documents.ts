"use server"

import { createClient } from "@/lib/supabase/server"
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
 * Construit un contexte plat à partir d'une entité étude/mission/personne
 * pour le remplissage des templates DOCX.
 */
export async function buildTemplateContext(
  scope: "etude" | "mission" | "personne" | "general",
  entityId: string,
  intervenantId?: string
): Promise<Record<string, any>> {
  const sb = createClient()
  const today = new Date()
  const base: Record<string, any> = {
    date: today.toLocaleDateString("fr-FR"),
    date_iso: today.toISOString().slice(0, 10),
    annee: String(today.getFullYear()),
  }

function buildPhasesContext(blocs: any[] | undefined) {
  if (!blocs || !Array.isArray(blocs)) return { phases: [], nb_jeh: 0, nb_phases: 0, planning: "" }
  
  // Trier par ordre / semaine_debut
  const sortedBlocs = [...blocs].sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || a.semaine_debut - b.semaine_debut)
  
  let totalJeh = 0
  const phases = sortedBlocs.map((b, i) => {
    const jeh = Number(b.nombre_jeh) || 0
    totalJeh += jeh
    return {
      numero: i + 1,
      lettre: String.fromCharCode(65 + i), // A, B, C...
      nom: b.nom || "",
      description: b.description || "",
      prix_jeh: Number(b.prix_jeh) || 0,
      nombre_jeh: jeh,
      semaine_debut: b.semaine_debut,
      semaine_fin: b.semaine_debut + (b.duree_semaines || 1) - 1,
    }
  })

  // Génération d'un tableau brut XML pour {@planning}
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

  if (scope === "etude") {
    const { data: e } = await sb
      .from("etudes")
      .select(
        "*, clients(*), suiveur:personnes!etudes_suiveur_id_fkey(id, prenom, nom, email), echeancier_blocs(*)"
      )
      .eq("id", entityId)
      .single()
    if (!e) return base
    const budget_ht = Number((e as any).budget_ht) || 0
    const frais = Number((e as any).frais_dossier) || 0
    const margePct = Number((e as any).marge_pct) || 0
    const tarif = budget_ht + frais + budget_ht * (margePct / 100)
    
    const { phases, nb_jeh, nb_phases, planning } = buildPhasesContext((e as any).echeancier_blocs)

    return {
      ...base,
      etude: {
        ...e,
        prix: tarif.toFixed(2), // Demande utilisateur: {etude.prix}
        frais: frais.toFixed(2),
        tarif_ht: tarif.toFixed(2),
        marge_euros: (budget_ht * (margePct / 100)).toFixed(2),
        nb_jeh,
        nb_phases,
      },
      client: (e as any).clients ?? {},
      suiveur: (e as any).suiveur ?? {},
      phases,
      planning,
    }
  }

  if (scope === "mission") {
    const { data: m } = await sb
      .from("missions")
      .select(
        "*, intervenant:personnes!missions_intervenant_id_fkey(*), etudes(*, clients(*), suiveur:personnes!etudes_suiveur_id_fkey(id, prenom, nom, email), echeancier_blocs(*))"
      )
      .eq("id", entityId)
      .single()
    if (!m) return base
    const etude = (m as any).etudes ?? {}
    const { phases, nb_jeh, nb_phases, planning } = buildPhasesContext(etude.echeancier_blocs)
    
    const budget_ht = Number(etude.budget_ht) || 0
    const frais = Number(etude.frais_dossier) || 0
    const margePct = Number(etude.marge_pct) || 0
    const tarif = budget_ht + frais + budget_ht * (margePct / 100)

    let selectedIntervenant = (m as any).intervenant ?? {}
    if (intervenantId) {
      const { data: p } = await sb.from("personnes").select("*").eq("id", intervenantId).single()
      if (p) selectedIntervenant = p
    }

    return {
      ...base,
      mission: m,
      etude: {
        ...etude,
        prix: tarif.toFixed(2),
        frais: frais.toFixed(2),
        tarif_ht: tarif.toFixed(2),
        nb_jeh,
        nb_phases,
      },
      client: etude.clients ?? {},
      suiveur: etude.suiveur ?? {},
      intervenant: selectedIntervenant,
      phases,
      planning,
    }
  }

  if (scope === "personne") {
    const { data: p } = await sb.from("personnes").select("*").eq("id", entityId).single()
    return { ...base, personne: p ?? {} }
  }

  return base
}
