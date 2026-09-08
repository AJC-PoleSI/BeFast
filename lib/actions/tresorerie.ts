"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath, revalidateTag, unstable_noStore as noStore } from "next/cache"
import { FACTURES_TAG, MISSIONS_TAG } from "@/lib/cache-tags"
import { getCachedProfile } from "@/lib/auth/cached-profile"
import { hasPermission } from "@/lib/auth/permissions"
import {
  buildRetributionRows,
  agregerParPersonne,
  kpisRetributions,
  type MissionSource,
  type IntervenantSource,
  type RetributionRecord,
} from "@/lib/tresorerie/retributions"

// Suivi de trésorerie (factures, paiements) : réservé aux profils disposant de
// la permission `voir_factures` (Présidente, Trésorier·ère, Pôle Trésorerie…).
// Avant ce garde, n'importe quel compte authentifié pouvait créer/modifier/
// supprimer une facture via ces server actions, la permission ne filtrant que
// l'affichage du lien dans la sidebar.
async function requireVoirFactures(userId: string): Promise<string | null> {
  const profile = await getCachedProfile(userId)
  if (!hasPermission(profile, "voir_factures")) return "Non autorisé"
  return null
}

export type FactureRow = {
  id: string
  numero: string
  nom: string | null
  montant_ht: number
  type: "acompte" | "intermediaire" | "solde" | null
  accompte_pct: number | null
  date_emission: string | null
  date_echeance: string | null
  date_paiement: string | null
  notes: string | null
  conditions_reglement: string | null
  etude_id: string | null
  bloc_id: string | null
  etude_numero: string | null
  etude_nom: string | null
  jours_retard: number | null
  statut: "payee" | "en_retard" | "a_venir" | "brouillon"
}

// Le suivi des rétributions se fait désormais intervenant par intervenant
// (une ligne par couple mission/personne) : les types vivent dans le module
// pur `lib/tresorerie/retributions.ts` et sont réexportés ici pour la page.
export type {
  RetributionRow,
  RetributionParPersonne,
} from "@/lib/tresorerie/retributions"

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
  const permErr = await requireVoirFactures(user.id)
  if (permErr) return { error: permErr }

  let migrationMissing = false

  // Factures et missions sont indépendantes → on lance les deux requêtes en parallèle
  // (gros gain de latence par rapport à un enchaînement séquentiel).
  const [facturesRes, missionsRes0] = await Promise.all([
    supabase
      .from("factures")
      // ⚠️ `etudes.budget` n'existe pas dans ce schéma (la colonne s'appelle
      // `budget_ht`). L'y référencer faisait échouer TOUTE la requête en 42703,
      // ce qui basculait la page en « migration manquante » : liste de factures
      // vide et bouton « Nouvelle facture » désactivé.
      .select("*, etudes(id, numero, nom, type, budget_ht)")
      .order("date_emission", { ascending: false, nullsFirst: false }),
    supabase
      .from("missions")
      .select(
        "id, nom, etude_id, date_debut, date_fin, date_paiement, numero_bv, intervenant_id, remuneration, nb_jeh, nb_intervenants, etudes(id, numero, nom)"
      )
      .order("date_fin", { ascending: false, nullsFirst: false }),
  ])

  let facturesData: any[] = []
  if (facturesRes.error) {
    // Code 42P01 = "relation does not exist" → migration pas encore appliquée.
    // On ne se fie PLUS au message ("does not exist" matche aussi une colonne
    // absente, 42703) : une simple faute de frappe dans le SELECT faisait alors
    // passer la page en mode dégradé au lieu de remonter l'erreur.
    if (facturesRes.error.code === "42P01") {
      migrationMissing = true
    } else {
      return { error: facturesRes.error.message }
    }
  } else {
    facturesData = facturesRes.data ?? []
  }

  // Missions — si les nouvelles colonnes n'existent pas, fallback sur l'ancien SELECT
  let missionsRes = missionsRes0

  if (missionsRes.error) {
    // Code 42703 = "column does not exist" → migration partielle
    if (missionsRes.error.code === "42703") {
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

  // Intervenants d'une mission = candidatures acceptées + intervenant assigné
  // directement (missions de suivi d'étude). Même règle que
  // listMissionIntervenants dans lib/actions/documents.ts.
  //
  // Pas de filtre `.in("mission_id", …)` : la requête missions ci-dessus n'est
  // elle-même pas filtrée, donc toutes les candidatures acceptées et toutes
  // les rétributions concernent forcément une mission déjà chargée. Le filtre
  // ne restreindrait rien et ferait grossir l'URL GET d'un UUID par mission
  // (414 Request-URI Too Large passé quelques centaines de missions).
  const aDesMissions = (missionsRes.data ?? []).length > 0

  const [candidaturesRes, retributionsRes] = await Promise.all([
    // `candidatures` et `retributions` ont chacune deux clés étrangères vers
    // `personnes` (personne_id et created_by) : sans l'indice explicite de
    // contrainte, PostgREST refuse la jointure (PGRST201, embed ambigu).
    aDesMissions
      ? supabase
          .from("candidatures")
          .select("mission_id, personne_id, personnes!candidatures_personne_id_fkey(id, prenom, nom)")
          .eq("statut", "acceptee")
      : Promise.resolve({ data: [] as any[], error: null }),
    aDesMissions
      ? supabase
          .from("retributions")
          .select(
            "mission_id, personne_id, numero_bv, date_paiement, montant, personnes!retributions_personne_id_fkey(id, prenom, nom)"
          )
      : Promise.resolve({ data: [] as any[], error: null }),
  ])

  // Table absente (migration 067 pas encore appliquée) : on continue en mode
  // dégradé — les lignes s'affichent, seul l'enregistrement des paiements
  // individuels est indisponible. PostgREST renvoie PGRST205 quand la table
  // manque dans son cache de schéma, 42P01 quand l'erreur remonte de Postgres.
  let retributionsData: any[] = []
  if (retributionsRes.error) {
    const code = (retributionsRes.error as any).code
    if (code === "42P01" || code === "PGRST205") {
      migrationMissing = true
    } else {
      return { error: retributionsRes.error.message }
    }
  } else {
    retributionsData = retributionsRes.data ?? []
  }
  if (candidaturesRes.error) return { error: candidaturesRes.error.message }

  // Personnes assignées directement (hors candidatures) : un seul aller-retour.
  const intervenantIds = Array.from(
    new Set((missionsRes.data ?? []).map((m: any) => m.intervenant_id).filter(Boolean))
  ) as string[]
  const personnesById = new Map<string, { id: string; prenom: string | null; nom: string | null }>()
  if (intervenantIds.length > 0) {
    const personnesRes = await supabase
      .from("personnes")
      .select("id, prenom, nom")
      .in("id", intervenantIds)
    for (const p of personnesRes.data ?? []) personnesById.set(p.id, p)
  }

  const nomComplet = (p: { prenom?: string | null; nom?: string | null } | null | undefined) =>
    p ? [p.prenom, p.nom].filter(Boolean).join(" ").trim() || null : null

  const missionSources: MissionSource[] = (missionsRes.data ?? []).map((m: any) => ({
    id: m.id,
    nom: m.nom,
    etude_id: m.etude_id,
    etude_numero: m.etudes?.numero ?? null,
    etude_nom: m.etudes?.nom ?? null,
    date_debut: m.date_debut,
    date_fin: m.date_fin,
    remuneration: Number(m.remuneration ?? 0),
    nb_jeh: Number(m.nb_jeh ?? 0),
    nb_intervenants: Number(m.nb_intervenants ?? 1),
    date_paiement: m.date_paiement ?? null,
    numero_bv: m.numero_bv ?? null,
  }))

  const intervenantSources: IntervenantSource[] = [
    ...(candidaturesRes.data ?? []).map((c: any) => ({
      mission_id: c.mission_id,
      personne_id: c.personne_id,
      nom: nomComplet(c.personnes) ?? "Intervenant·e",
    })),
    ...(missionsRes.data ?? [])
      .filter((m: any) => m.intervenant_id)
      .map((m: any) => ({
        mission_id: m.id,
        personne_id: m.intervenant_id,
        nom: nomComplet(personnesById.get(m.intervenant_id)) ?? "Intervenant·e",
      })),
  ]

  const retributionRecords: RetributionRecord[] = retributionsData.map((r: any) => ({
    mission_id: r.mission_id,
    personne_id: r.personne_id,
    personne_nom: nomComplet(r.personnes),
    numero_bv: r.numero_bv ?? null,
    date_paiement: r.date_paiement ?? null,
    montant: Number(r.montant ?? 0),
  }))

  const retributions = buildRetributionRows(missionSources, intervenantSources, retributionRecords)
  const retributionsParPersonne = agregerParPersonne(retributions)

  const factures: FactureRow[] = facturesData.map((f: any) => ({
    id: f.id,
    numero: f.numero,
    nom: f.nom,
    montant_ht: Number(f.montant_ht ?? 0),
    type: f.type ?? null,
    accompte_pct: f.accompte_pct != null ? Number(f.accompte_pct) : null,
    date_emission: f.date_emission,
    date_echeance: f.date_echeance,
    date_paiement: f.date_paiement,
    notes: f.notes,
    conditions_reglement: f.conditions_reglement ?? null,
    etude_id: f.etude_id,
    bloc_id: f.bloc_id,
    etude_numero: f.etudes?.numero ?? null,
    etude_nom: f.etudes?.nom ?? null,
    jours_retard: joursRetard(f.date_emission, f.date_paiement),
    statut: computeStatut(f.date_emission, f.date_paiement),
  }))

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
      row.budget = Number((f.etudes as any).budget_ht ?? 0)
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
  const { totalRetributionDue, totalRetributionVersee, nbRetributionsAPayer } =
    kpisRetributions(retributions)

  const notesRes = await supabase
    .from("notes_de_frais")
    .select(`
      id, numero_note_de_frais, montant_total, description, fichiers_justificatifs, statut, submitted_at, validated_at,
      intervenant:intervenant_id(prenom, nom),
      mission:mission_id(nom, etudes(numero))
    `)
    .neq("statut", "brouillon")
    .order("submitted_at", { ascending: false })

  const notes_de_frais = notesRes.data ?? []

  return {
    data: {
      factures,
      retributions,
      retributionsParPersonne,
      notes_de_frais,
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
        nbRetributionsAPayer,
        nbNotesSoumises: notes_de_frais.filter((n: any) => n.statut === 'soumis').length
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
  const permErr = await requireVoirFactures(user.id)
  if (permErr) return { error: permErr }

  const { data, error } = await supabase
    .from("etudes")
    .select("id, numero, nom, budget_ht, frais_dossier")
    .order("numero", { ascending: false })
  if (error) return { error: error.message }
  // `total_ht` = prestation + frais de structure : c'est l'assiette sur
  // laquelle le trésorier applique le % d'acompte.
  return {
    data: (data ?? []).map((e: any) => ({
      id: e.id,
      numero: e.numero,
      nom: e.nom,
      total_ht:
        Math.round(((Number(e.budget_ht) || 0) + (Number(e.frais_dossier) || 0)) * 100) / 100,
    })),
  }
}

export async function createFacture(input: {
  numero: string
  nom?: string | null
  etude_id?: string | null
  bloc_id?: string | null
  montant_ht: number
  type?: "acompte" | "intermediaire" | "solde" | null
  accompte_pct?: number | null
  date_emission?: string | null
  date_echeance?: string | null
  date_paiement?: string | null
  notes?: string | null
  conditions_reglement?: string | null
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }
  const permErr = await requireVoirFactures(user.id)
  if (permErr) return { error: permErr }

  const { data, error } = await supabase
    .from("factures")
    .insert({
      numero: input.numero,
      nom: input.nom ?? null,
      etude_id: input.etude_id ?? null,
      bloc_id: input.bloc_id ?? null,
      montant_ht: input.montant_ht,
      type: input.type ?? null,
      accompte_pct: input.type === "acompte" ? input.accompte_pct ?? null : null,
      date_emission: input.date_emission ?? null,
      date_echeance: input.date_echeance ?? null,
      date_paiement: input.date_paiement ?? null,
      notes: input.notes ?? null,
      conditions_reglement: input.conditions_reglement ?? null,
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
    type: "acompte" | "intermediaire" | "solde" | null
    accompte_pct: number | null
    date_emission: string | null
    date_echeance: string | null
    date_paiement: string | null
    notes: string | null
    conditions_reglement: string | null
  }>
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }
  const permErr = await requireVoirFactures(user.id)
  if (permErr) return { error: permErr }

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
  const permErr = await requireVoirFactures(user.id)
  if (permErr) return { error: permErr }

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
  const permErr = await requireVoirFactures(user.id)
  if (permErr) return { error: permErr }

  const updates: Record<string, any> = { date_paiement }
  if (numero_bv !== undefined) updates.numero_bv = numero_bv

  const { error } = await supabase.from("missions").update(updates).eq("id", missionId)
  if (error) return { error: error.message }
  revalidateTag(MISSIONS_TAG)
  revalidatePath("/tresorerie")
  return { success: true }
}
