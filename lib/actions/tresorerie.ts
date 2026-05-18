"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath, revalidateTag, unstable_noStore as noStore } from "next/cache"
import { FACTURES_TAG, MISSIONS_TAG } from "@/lib/cache-tags"

export type FactureRow = {
  id: string
  numero: string
  nom: string | null
  montant_ht: number
  date_emission: string | null
  date_echeance: string | null
  date_paiement: string | null
  notes: string | null
  etude_id: string | null
  bloc_id: string | null
  etude_numero: string | null
  etude_nom: string | null
  jours_retard: number | null
  statut: "payee" | "en_retard" | "a_venir" | "brouillon"
}

export type MissionPayRow = {
  id: string
  nom: string
  etude_id: string | null
  etude_numero: string | null
  etude_nom: string | null
  date_debut: string | null
  date_fin: string | null
  date_paiement: string | null
  numero_bv: string | null
  paye: boolean
  montant: number
  intervenant_id: string | null
  intervenant_nom: string | null
}

export type CaParEtude = {
  etude_id: string
  etude_numero: string | null
  etude_nom: string
  type: string | null
  facture: number
  paye: number
  budget: number
}

function computeStatut(date_emission: string | null, date_paiement: string | null): FactureRow["statut"] {
  if (date_paiement) return "payee"
  if (!date_emission) return "brouillon"
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const emis = new Date(date_emission)
  return emis < today ? "en_retard" : "a_venir"
}

function joursRetard(date_emission: string | null, date_paiement: string | null): number | null {
  if (date_paiement || !date_emission) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const emis = new Date(date_emission)
  const diff = Math.floor((today.getTime() - emis.getTime()) / (1000 * 60 * 60 * 24))
  return diff > 0 ? diff : null
}

export async function getTresorerieData() {
  noStore()
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  let migrationMissing = false

  // Factures + études jointes — graceful fallback si la table n'existe pas encore
  const facturesRes = await supabase
    .from("factures")
    .select("*, etudes(id, numero, nom, type, budget_ht, budget)")
    .order("date_emission", { ascending: false, nullsFirst: false })

  let facturesData: any[] = []
  if (facturesRes.error) {
    // Code 42P01 = "relation does not exist" → migration pas encore appliquée
    if (facturesRes.error.code === "42P01" || /does not exist/i.test(facturesRes.error.message)) {
      migrationMissing = true
    } else {
      return { error: facturesRes.error.message }
    }
  } else {
    facturesData = facturesRes.data ?? []
  }

  // Missions — essaie avec les nouvelles colonnes ; si elles n'existent pas, fallback sur l'ancien SELECT
  let missionsRes = await supabase
    .from("missions")
    .select(
      "id, nom, etude_id, date_debut, date_fin, date_paiement, numero_bv, intervenant_id, remuneration, nb_jeh, nb_intervenants, etudes(id, numero, nom)"
    )
    .order("date_fin", { ascending: false, nullsFirst: false })

  if (missionsRes.error) {
    // Code 42703 = "column does not exist" → migration partielle
    if (missionsRes.error.code === "42703" || /does not exist/i.test(missionsRes.error.message)) {
      migrationMissing = true
      const fallback = await supabase
        .from("missions")
        .select(
          "id, nom, etude_id, date_debut, date_fin, intervenant_id, remuneration, nb_jeh, nb_intervenants, etudes(id, numero, nom)"
        )
        .order("date_fin", { ascending: false, nullsFirst: false })
      if (fallback.error) return { error: fallback.error.message }
      missionsRes = fallback as unknown as typeof missionsRes
    } else {
      return { error: missionsRes.error.message }
    }
  }

  // Fetch intervenants (personnes) for any missions that have intervenant_id
  const intervenantIds = Array.from(
    new Set((missionsRes.data ?? []).map((m: any) => m.intervenant_id).filter(Boolean))
  ) as string[]

  let personnesById = new Map<string, { id: string; prenom: string | null; nom: string | null }>()
  if (intervenantIds.length > 0) {
    const personnesRes = await supabase
      .from("personnes")
      .select("id, prenom, nom")
      .in("id", intervenantIds)
    for (const p of personnesRes.data ?? []) {
      personnesById.set(p.id, p)
    }
  }

  const factures: FactureRow[] = facturesData.map((f: any) => ({
    id: f.id,
    numero: f.numero,
    nom: f.nom,
    montant_ht: Number(f.montant_ht ?? 0),
    date_emission: f.date_emission,
    date_echeance: f.date_echeance,
    date_paiement: f.date_paiement,
    notes: f.notes,
    etude_id: f.etude_id,
    bloc_id: f.bloc_id,
    etude_numero: f.etudes?.numero ?? null,
    etude_nom: f.etudes?.nom ?? null,
    jours_retard: joursRetard(f.date_emission, f.date_paiement),
    statut: computeStatut(f.date_emission, f.date_paiement),
  }))

  const missions: MissionPayRow[] = (missionsRes.data ?? []).map((m: any) => {
    const p = m.intervenant_id ? personnesById.get(m.intervenant_id) : null
    const intervenant_nom = p
      ? [p.prenom, p.nom].filter(Boolean).join(" ").trim() || null
      : null
    const totalJeh = Number(m.nb_jeh ?? 0) * Number(m.nb_intervenants ?? 1)
    const montant = Number(m.remuneration ?? 0) * totalJeh
    return {
      id: m.id,
      nom: m.nom,
      etude_id: m.etude_id,
      etude_numero: m.etudes?.numero ?? null,
      etude_nom: m.etudes?.nom ?? null,
      date_debut: m.date_debut,
      date_fin: m.date_fin,
      date_paiement: m.date_paiement,
      numero_bv: m.numero_bv,
      paye: !!m.date_paiement,
      montant,
      intervenant_id: m.intervenant_id,
      intervenant_nom,
    }
  })

  // CA par étude (agrégé)
  const caMap = new Map<string, CaParEtude>()
  for (const f of factures) {
    if (!f.etude_id) continue
    let row = caMap.get(f.etude_id)
    if (!row) {
      row = {
        etude_id: f.etude_id,
        etude_numero: f.etude_numero,
        etude_nom: f.etude_nom ?? "",
        type: null,
        facture: 0,
        paye: 0,
        budget: 0,
      }
      caMap.set(f.etude_id, row)
    }
    row.facture += f.montant_ht
    if (f.date_paiement) row.paye += f.montant_ht
  }
  // Add étude type/budget from facture rows
  for (const f of facturesData) {
    if (!f.etude_id || !f.etudes) continue
    const row = caMap.get(f.etude_id)
    if (row) {
      row.type = (f.etudes as any).type ?? null
      row.budget = Number((f.etudes as any).budget_ht ?? (f.etudes as any).budget ?? 0)
    }
  }
  const caParEtude = Array.from(caMap.values())

  // KPIs
  const totalFacture = factures.reduce((s, f) => s + f.montant_ht, 0)
  const totalEncaisse = factures.filter((f) => f.date_paiement).reduce((s, f) => s + f.montant_ht, 0)
  const totalEnAttente = totalFacture - totalEncaisse
  const totalEnRetard = factures
    .filter((f) => f.statut === "en_retard")
    .reduce((s, f) => s + f.montant_ht, 0)
  const totalRetributionDue = missions.filter((m) => !m.paye).reduce((s, m) => s + m.montant, 0)
  const totalRetributionVersee = missions.filter((m) => m.paye).reduce((s, m) => s + m.montant, 0)

  return {
    data: {
      factures,
      missions,
      caParEtude,
      migrationMissing,
      kpis: {
        totalFacture,
        totalEncaisse,
        totalEnAttente,
        totalEnRetard,
        totalRetributionDue,
        totalRetributionVersee,
        nbFactures: factures.length,
        nbFacturesImpayees: factures.filter((f) => !f.date_paiement).length,
        nbMissionsAPayer: missions.filter((m) => !m.paye).length,
      },
    },
  }
}

export async function getEtudesForFactureSelect() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { data, error } = await supabase
    .from("etudes")
    .select("id, numero, nom")
    .order("numero", { ascending: false })
  if (error) return { error: error.message }
  return { data: data ?? [] }
}

export async function createFacture(input: {
  numero: string
  nom?: string | null
  etude_id?: string | null
  bloc_id?: string | null
  montant_ht: number
  date_emission?: string | null
  date_echeance?: string | null
  date_paiement?: string | null
  notes?: string | null
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { data, error } = await supabase
    .from("factures")
    .insert({
      numero: input.numero,
      nom: input.nom ?? null,
      etude_id: input.etude_id ?? null,
      bloc_id: input.bloc_id ?? null,
      montant_ht: input.montant_ht,
      date_emission: input.date_emission ?? null,
      date_echeance: input.date_echeance ?? null,
      date_paiement: input.date_paiement ?? null,
      notes: input.notes ?? null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    if (error.code === "23505") return { error: "Ce numéro de facture existe déjà." }
    return { error: error.message }
  }
  revalidateTag(FACTURES_TAG)
  revalidatePath("/tresorerie")
  return { data }
}

export async function updateFacture(
  id: string,
  updates: Partial<{
    numero: string
    nom: string | null
    etude_id: string | null
    montant_ht: number
    date_emission: string | null
    date_echeance: string | null
    date_paiement: string | null
    notes: string | null
  }>
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { error } = await supabase.from("factures").update(updates).eq("id", id)
  if (error) return { error: error.message }
  revalidateTag(FACTURES_TAG)
  revalidatePath("/tresorerie")
  return { success: true }
}

export async function deleteFacture(id: string) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { error } = await supabase.from("factures").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidateTag(FACTURES_TAG)
  revalidatePath("/tresorerie")
  return { success: true }
}

export async function marquerFacturePaiement(id: string, date_paiement: string | null) {
  return updateFacture(id, { date_paiement })
}

export async function marquerMissionPaiement(
  missionId: string,
  date_paiement: string | null,
  numero_bv?: string | null
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const updates: Record<string, any> = { date_paiement }
  if (numero_bv !== undefined) updates.numero_bv = numero_bv

  const { error } = await supabase.from("missions").update(updates).eq("id", missionId)
  if (error) return { error: error.message }
  revalidateTag(MISSIONS_TAG)
  revalidatePath("/tresorerie")
  return { success: true }
}
