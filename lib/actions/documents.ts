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
  updates: Partial<{ name: string; description: string; scope: string; category: string }>
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
  entityId: string
): Promise<Record<string, any>> {
  const sb = createClient()
  const today = new Date()
  const base: Record<string, any> = {
    date: today.toLocaleDateString("fr-FR"),
    date_iso: today.toISOString().slice(0, 10),
    annee: String(today.getFullYear()),
  }

  if (scope === "etude") {
    const { data: e } = await sb
      .from("etudes")
      .select(
        "*, clients(*), suiveur:personnes!etudes_suiveur_id_fkey(id, prenom, nom, email)"
      )
      .eq("id", entityId)
      .single()
    if (!e) return base
    const budget_ht = Number((e as any).budget_ht) || 0
    const frais = Number((e as any).frais_dossier) || 0
    const margePct = Number((e as any).marge_pct) || 0
    const tarif = budget_ht + frais + budget_ht * (margePct / 100)
    return {
      ...base,
      etude: {
        ...e,
        tarif_ht: tarif.toFixed(2),
        marge_euros: (budget_ht * (margePct / 100)).toFixed(2),
      },
      client: (e as any).clients ?? {},
      suiveur: (e as any).suiveur ?? {},
    }
  }

  if (scope === "mission") {
    const { data: m } = await sb
      .from("missions")
      .select(
        "*, etudes(*, clients(*), suiveur:personnes!etudes_suiveur_id_fkey(id, prenom, nom, email))"
      )
      .eq("id", entityId)
      .single()
    if (!m) return base
    const etude = (m as any).etudes ?? {}
    return {
      ...base,
      mission: m,
      etude,
      client: etude.clients ?? {},
      suiveur: etude.suiveur ?? {},
    }
  }

  if (scope === "personne") {
    const { data: p } = await sb.from("personnes").select("*").eq("id", entityId).single()
    return { ...base, personne: p ?? {} }
  }

  return base
}
