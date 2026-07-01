"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath, revalidateTag, unstable_noStore as noStore } from "next/cache"
import { ETUDES_TAG, MEMBERS_TAG, CLIENTS_TAG, PROPOSALS_TAG } from "@/lib/cache-tags"
import type { BudgetInput, PaiementModalites } from "@/lib/budget/compute"
import { computeBudget } from "@/lib/budget/compute"

// Couleurs de Gantt — identiques à la page étude pour une cohérence visuelle
const GANTT_COLORS = [
  "#00236f", "#2563eb", "#0891b2", "#059669", "#65a30d",
  "#d97706", "#dc2626", "#db2777", "#7c3aed", "#475569",
]

// Niveau intervenant (L3/M1/M2) -> classe mission (premaster/m1/m2)
function niveauToClasse(niveau?: string | null): string | null {
  switch ((niveau || "").toUpperCase()) {
    case "L3":
      return "premaster"
    case "M1":
      return "m1"
    case "M2":
      return "m2"
    default:
      return null
  }
}

// ---- Référentiels (réutilisés par le formulaire) ----

// Membres AJC validés — alimente le menu déroulant CDP
export async function getProposalMembers() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const sb = createAdminClient()

  // Exclude intervenants — only show validated AJC members as CDP candidates
  const { data: intervenantType } = await sb
    .from("profils_types")
    .select("id")
    .eq("slug", "intervenant")
    .maybeSingle()

  let query = sb
    .from("personnes")
    .select("id, prenom, nom, email")
    .eq("account_status", "validated")
    .order("nom", { ascending: true })

  if (intervenantType?.id) {
    query = query.neq("profil_type_id", intervenantType.id)
  }

  const { data, error } = await query
  if (error) return { error: error.message }

  // On écarte les enregistrements vides (sans prénom NI nom) qui produisaient
  // des lignes "()" dans le menu CDP. À défaut de nom, on retombe sur l'email.
  const cleaned = (data ?? [])
    .filter((m: any) => (m.prenom?.trim() || m.nom?.trim() || m.email?.trim()))
    .map((m: any) => ({
      ...m,
      prenom: m.prenom?.trim() || "",
      nom: m.nom?.trim() || (m.prenom?.trim() ? "" : (m.email?.trim() || "Sans nom")),
    }))
  return { data: cleaned }
}

export async function getProposalClients() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const sb = createAdminClient()
  const { data, error } = await sb
    .from("clients")
    .select("id, nom, type, contact_nom, contact_email, contact_phone")
    .order("nom", { ascending: true })
  if (error) return { error: error.message }
  return { data }
}

// ---- Lecture des propositions ----

export async function getProposals() {
  noStore()
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { data, error } = await supabase
    .from("proposals")
    .select("*, proposal_phases(*)")
    .order("created_at", { ascending: false })
  if (error) return { error: error.message }
  return { data }
}

export async function getProposal(id: string) {
  noStore()
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { data, error } = await supabase
    .from("proposals")
    .select("*, proposal_phases(*)")
    .eq("id", id)
    .single()
  if (error) return { error: error.message }
  return { data }
}

// ---- Écriture des propositions ----

export type ProposalPhaseInput = {
  name: string
  objectifs?: string
  methodologie?: string
  contraintes?: string
  duree_semaines?: number
  semaine_debut?: number
  intervenants_count?: number
  intervenants_niveau?: string
  jeh_count?: number
  jeh_price?: number
}

export type ProposalInput = {
  id: string
  status?: string
  cdp_id?: string | null
  cdp_custom?: string | null
  client_id?: string | null
  client_company?: string
  taille_entreprise?: string | null
  provenance?: string
  client_civilite?: string
  client_first_name?: string
  client_last_name?: string
  client_email?: string
  client_phone?: string
  study_type?: string
  start_date?: string
  global_frais_annexes?: number
  frais_dossier?: number
  marge_je?: number
  suivi_jeh_count?: number
  suivi_jeh_price?: number
  total_ht?: number
  total_ttc?: number
  context_situation?: string
  context_intervention?: string
  context_enjeu?: string
  cdc_objectifs?: string
  cdc_contraintes?: string
  cdc_livrables?: string
  paiement_modalites?: { type: string; versements: { label: string; pct: number }[] } | null
  phases?: ProposalPhaseInput[]
}

export async function saveProposal(input: ProposalInput) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  // Écritures via service_role : la RLS interdit désormais l'écriture directe
  // de proposals/proposal_phases aux membres (cf. migration 034). Les garde-fous
  // applicatifs (authentification, validation budget) restent appliqués ici.
  const sb = createAdminClient()

  // `paiement_modalites` est écrit séparément (best-effort) car la colonne peut
  // ne pas encore exister en base (migration 035). On l'isole du payload principal
  // pour ne pas faire échouer tout l'upsert si la colonne est absente.
  const { phases, paiement_modalites, ...proposal } = input

  // On ne touche pas au statut existant si la propale existe déjà (sauf 1ère création)
  const { data: existing } = await supabase
    .from("proposals")
    .select("id, status, etude_id, budget_status")
    .eq("id", input.id)
    .maybeSingle()

  const payload: Record<string, unknown> = {
    ...proposal,
    cdp_id: proposal.cdp_id || null,
    client_id: proposal.client_id || null,
    updated_at: new Date().toISOString(),
  }
  if (!existing) {
    payload.status = proposal.status || "envoyée"
    payload.created_by = user.id
  } else {
    // garde le statut courant si non fourni explicitement
    delete payload.status
  }

  // Validation de budget : enregistrer/modifier un budget l'envoie en validation,
  // sauf s'il est déjà validé (on ne re-soumet pas un budget validé tel quel).
  const currentBudgetStatus = (existing as any)?.budget_status as string | undefined
  if (currentBudgetStatus !== "valide") {
    payload.budget_status = "en_attente_validation"
    payload.budget_submitted_at = new Date().toISOString()
    payload.budget_comment = null
  }

  const { error: upErr } = await sb.from("proposals").upsert(payload)
  if (upErr) return { error: upErr.message }

  // Modalités de règlement : best-effort (ignore l'erreur si la colonne n'existe
  // pas encore, code Postgres 42703 « undefined_column »).
  if (paiement_modalites !== undefined) {
    const { error: modErr } = await sb
      .from("proposals")
      .update({ paiement_modalites })
      .eq("id", input.id)
    if (modErr && modErr.code !== "42703") {
      // Une autre erreur (RLS, contrainte…) est remontée pour ne pas masquer un vrai bug.
      return { error: modErr.message }
    }
  }

  // Remplace les phases
  await sb.from("proposal_phases").delete().eq("proposal_id", input.id)
  if (phases && phases.length > 0) {
    const rows = phases.map((p, i) => ({
      proposal_id: input.id,
      order_index: i,
      name: p.name,
      objectifs: p.objectifs ?? null,
      methodologie: p.methodologie ?? null,
      contraintes: p.contraintes ?? null,
      duree_semaines: Number(p.duree_semaines ?? 1),
      semaine_debut: Number(p.semaine_debut ?? 1),
      intervenants_count: Number(p.intervenants_count ?? 1),
      intervenants_niveau: p.intervenants_niveau ?? null,
      jeh_count: Number(p.jeh_count ?? 1),
      jeh_price: Number(p.jeh_price ?? 100),
    }))
    const { error: phErr } = await sb.from("proposal_phases").insert(rows)
    if (phErr) return { error: phErr.message }
  }

  revalidateTag(PROPOSALS_TAG)
  revalidatePath("/prospection")
  return { data: { id: input.id } }
}

export async function updateProposalStatus(id: string, status: string) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  // Garde-fou : une propale ne peut être réalisée (passage en CE ou signée)
  // que si son budget a été validé par la trésorerie.
  if (status === "CE éditée" || status === "CE signée") {
    const { data: prop } = await supabase
      .from("proposals")
      .select("budget_status")
      .eq("id", id)
      .single()
    if ((prop as any)?.budget_status !== "valide") {
      return { error: "Budget non validé : la proposition ne peut pas être réalisée tant que la trésorerie n'a pas validé le budget." }
    }
  }

  const sb = createAdminClient()
  const { error } = await sb
    .from("proposals")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) return { error: error.message }
  revalidateTag(PROPOSALS_TAG)
  revalidatePath("/prospection")
  return { success: true }
}

export async function deleteProposal(id: string) {
  // Suppression réservée aux administrateurs (auparavant garantie par la policy
  // RLS "proposals delete"). On revérifie côté serveur car l'écriture passe
  // désormais par le service_role qui ignore la RLS.
  if (!(await isCallerAdmin())) return { error: "Non autorisé" }

  const sb = createAdminClient()
  const { error } = await sb.from("proposals").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidateTag(PROPOSALS_TAG)
  revalidatePath("/prospection")
  return { success: true }
}

// ---- SIGNATURE DE LA CE -> CRÉATION D'UNE ÉTUDE RÉELLE ----
// Crée : 1 étude + N blocs d'échéancier (Gantt) + N missions (candidatures).
// Idempotent : si la propale a déjà une étude liée, on la renvoie sans recréer.
export async function signProposal(id: string) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  // Client admin pour orchestrer l'insertion multi-tables sans buter sur la RLS
  const sb = createAdminClient()

  const { data: prop, error: propErr } = await sb
    .from("proposals")
    .select("*, proposal_phases(*)")
    .eq("id", id)
    .single()
  if (propErr) return { error: propErr.message }
  if (!prop) return { error: "Proposition introuvable" }

  // Déjà signée -> on renvoie l'étude existante
  if (prop.etude_id) {
    return { data: { etudeId: prop.etude_id }, already: true }
  }

  // Garde-fou : pas de réalisation tant que le budget n'est pas validé.
  if ((prop as any).budget_status !== "valide") {
    return { error: "Budget non validé : impossible de signer la CE tant que la trésorerie n'a pas validé le budget de cette proposition." }
  }

  // 1. Résoudre / créer le client
  let clientId: string | null = prop.client_id ?? null
  if (!clientId && prop.client_company) {
    const contactNom = [prop.client_first_name, prop.client_last_name]
      .filter(Boolean)
      .join(" ")
      .trim()
    const { data: newClient, error: clErr } = await sb
      .from("clients")
      .insert({
        nom: prop.client_company,
        contact_nom: contactNom || null,
        contact_email: prop.client_email || null,
        contact_phone: prop.client_phone || null,
        type: "cs",
        actif: true,
      })
      .select("id")
      .single()
    if (clErr) return { error: `Création client: ${clErr.message}` }
    clientId = newClient?.id ?? null
  }

  // 2. Créer l'étude
  const studyName = [prop.study_type, prop.client_company]
    .filter(Boolean)
    .join(" — ") || `Étude ${prop.id}`
  const description = [
    prop.context_situation && `Situation : ${prop.context_situation}`,
    prop.context_intervention && `Intervention : ${prop.context_intervention}`,
    prop.context_enjeu && `Enjeu : ${prop.context_enjeu}`,
    prop.cdc_objectifs && `Objectifs : ${prop.cdc_objectifs}`,
    prop.cdc_livrables && `Livrables : ${prop.cdc_livrables}`,
  ]
    .filter(Boolean)
    .join("\n\n")

  const { data: etude, error: etErr } = await sb
    .from("etudes")
    .insert({
      numero: prop.id,
      nom: studyName,
      client_id: clientId,
      suiveur_id: prop.cdp_id ?? null,
      statut: "en_cours",
      type: "cs",
      budget_ht: prop.total_ht ?? 0,
      description: description || null,
      date_debut: prop.start_date ?? null,
      created_by: user.id,
    })
    .select("id")
    .single()
  if (etErr) {
    if ((etErr as { code?: string }).code === "23505") {
      return { error: "Une étude avec ce numéro existe déjà." }
    }
    return { error: `Création étude: ${etErr.message}` }
  }
  const etudeId = etude!.id as string

  // 3. Phases -> blocs d'échéancier (Gantt) + missions
  const phases = ((prop.proposal_phases as any[]) || []).slice().sort(
    (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
  )

  let cursor = 1 // semaine de départ si non renseignée
  const blocs: any[] = []
  const missions: any[] = []
  phases.forEach((ph, i) => {
    const duree = Number(ph.duree_semaines || 1)
    const debut = Number(ph.semaine_debut) > 0 ? Number(ph.semaine_debut) : cursor
    cursor = debut + duree

    blocs.push({
      etude_id: etudeId,
      nom: ph.name,
      semaine_debut: debut,
      duree_semaines: duree,
      couleur: GANTT_COLORS[i % GANTT_COLORS.length],
      ordre: i,
      jeh: Number(ph.jeh_count || 0),
    })

    missions.push({
      etude_id: etudeId,
      nom: ph.name,
      type: "intervenant",
      classe: niveauToClasse(ph.intervenants_niveau),
      description: ph.objectifs || null,
      nb_jeh: Number(ph.jeh_count || 0),
      nb_intervenants: Math.round(Number(ph.intervenants_count || 0)) || null,
      taux_jour: Number(ph.jeh_price || 0),
      nb_jours: Number(ph.jeh_count || 0),
      statut: "ouverte",
      created_by: user.id,
    })
  })

  if (blocs.length > 0) {
    const { error: blErr } = await sb.from("echeancier_blocs").insert(blocs)
    if (blErr) return { error: `Échéancier: ${blErr.message}` }
  }
  if (missions.length > 0) {
    const { error: miErr } = await sb.from("missions").insert(missions)
    if (miErr) return { error: `Missions: ${miErr.message}` }
  }

  // 3bis. Tracer le budget effectif par phase (alimente le prix JEH brut moyen).
  // Best-effort : si la table budget_etude n'existe pas encore, on n'échoue pas.
  const budgetRows = phases.map((ph: any) => ({
    etude_id: etudeId,
    phase: ph.name,
    nb_jeh: Number(ph.jeh_count || 0),
    prix_jeh: Number(ph.jeh_price || 0),
    marge_pct: Number((prop as any).marge_je || 0),
  }))
  if (budgetRows.length > 0) {
    await sb.from("budget_etude").insert(budgetRows)
  }

  // 3ter. Générer les factures à partir des modalités de règlement du budget.
  // Une facture par versement (montant HT = % du Total HT). Best-effort : on
  // n'échoue jamais la signature si l'insertion des factures pose problème.
  try {
    let tvaPct = 20
    const { data: tvaParam } = await sb
      .from("parametres")
      .select("value")
      .eq("key", "tva_rate")
      .maybeSingle()
    if (tvaParam?.value != null) {
      const parsed = Number(tvaParam.value)
      if (!Number.isNaN(parsed) && parsed > 0) tvaPct = parsed
    }

    const rawModalites = (prop as any).paiement_modalites
    const modalites: PaiementModalites | null =
      rawModalites && Array.isArray(rawModalites.versements)
        ? {
            type: rawModalites.type === "pvri" ? "pvri" : "standard",
            versements: rawModalites.versements.map((v: any) => ({
              label: String(v.label ?? "Versement"),
              pct: Number(v.pct ?? 0),
            })),
          }
        : null

    const breakdown = computeBudget({
      phases: phases.map((ph: any) => ({
        name: ph.name,
        jehCount: Number(ph.jeh_count || 0),
        jehPrice: Number(ph.jeh_price || 0),
      })),
      suiviJehCount: Number((prop as any).suivi_jeh_count || 0),
      suiviJehPrice: Number((prop as any).suivi_jeh_price || 0),
      margeJePct: Number((prop as any).marge_je || 0),
      fraisDossier: Number((prop as any).frais_dossier || 0),
      globalFraisAnnexes: Number((prop as any).global_frais_annexes || 0),
      tvaPct,
      paiementModalites: modalites,
    })

    // Montants HT par versement (le dernier absorbe l'arrondi).
    const totalHt = breakdown.totalHt
    let cumulHt = 0
    const factureRows = breakdown.versements.map((v, i) => {
      const isLast = i === breakdown.versements.length - 1
      const montantHt = isLast
        ? Math.round((totalHt - cumulHt) * 100) / 100
        : Math.round(totalHt * (v.pct / 100) * 100) / 100
      cumulHt = Math.round((cumulHt + montantHt) * 100) / 100
      return {
        numero: `${prop.id}-F${i + 1}`,
        nom: v.label,
        etude_id: etudeId,
        montant_ht: montantHt,
        notes: `Généré automatiquement depuis le budget (versement ${v.pct} %).`,
        created_by: user.id,
      }
    })

    if (factureRows.length > 0) {
      await sb.from("factures").insert(factureRows)
    }
  } catch {
    // best-effort : la table factures peut être absente, on ignore.
  }

  // 4. Marquer la propale comme signée + lier l'étude
  const { error: updErr } = await sb
    .from("proposals")
    .update({
      status: "CE signée",
      etude_id: etudeId,
      signed_at: new Date().toISOString(),
      client_id: clientId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
  if (updErr) return { error: updErr.message }

  revalidateTag(PROPOSALS_TAG)
  revalidateTag(ETUDES_TAG)
  revalidateTag(CLIENTS_TAG)
  revalidateTag(MEMBERS_TAG)
  revalidatePath("/etudes")
  revalidatePath("/prospection")
  return { data: { etudeId } }
}

// ============================================================
// VALIDATION DE BUDGET (Trésorerie — administrateur)
// ============================================================

async function isCallerAdmin(): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const sb = createAdminClient()
  const { data } = await sb
    .from("personnes")
    .select("profils_types!profil_type_id(slug)")
    .eq("id", user.id)
    .single()
  return (data?.profils_types as any)?.slug === "administrateur"
}

export type BudgetValidationRow = {
  id: string
  client_company: string | null
  study_type: string | null
  cdp_id: string | null
  total_ht: number | null
  total_ttc: number | null
  budget_status: string
  budget_comment: string | null
  budget_submitted_at: string | null
  created_at: string
}

// Liste des propales pour la validation de budget (admin uniquement).
export async function getBudgetValidations() {
  noStore()
  if (!(await isCallerAdmin())) return { error: "Non autorisé" }

  const sb = createAdminClient()
  const { data, error } = await sb
    .from("proposals")
    .select("id, client_company, study_type, cdp_id, total_ht, total_ttc, budget_status, budget_comment, budget_submitted_at, created_at")
    .order("budget_submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
  if (error) return { error: error.message }
  return { data: data as BudgetValidationRow[] }
}

// Valider ou rejeter le budget d'une propale (admin uniquement).
export async function decideBudget(id: string, decision: "valide" | "rejete", comment?: string) {
  if (!(await isCallerAdmin())) return { error: "Non autorisé" }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const sb = createAdminClient()

  const { error } = await sb
    .from("proposals")
    .update({
      budget_status: decision,
      budget_comment: comment?.trim() || null,
      budget_validated_by: user?.id ?? null,
      budget_validated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
  if (error) return { error: error.message }

  revalidateTag(PROPOSALS_TAG)
  revalidatePath("/tresorerie")
  revalidatePath("/prospection")
  return { success: true }
}

// Détail complet du budget d'une propale (phases + paramètres) pour la modale
// de validation trésorerie et l'export Excel. Admin uniquement.
export type ProposalBudgetDetail = {
  id: string
  client_company: string | null
  study_type: string | null
  cdp_name: string | null
  budget_status: string
  budget_comment: string | null
  budget: BudgetInput
  modalites: PaiementModalites | null
}

export async function getProposalBudget(id: string) {
  noStore()
  if (!(await isCallerAdmin())) return { error: "Non autorisé" }

  const sb = createAdminClient()
  const { data: prop, error } = await sb
    .from("proposals")
    .select(
      "id, client_company, study_type, cdp_id, cdp_custom, budget_status, budget_comment, suivi_jeh_count, suivi_jeh_price, global_frais_annexes, frais_dossier, marge_je, proposal_phases(name, jeh_count, jeh_price, order_index)"
    )
    .eq("id", id)
    .single()
  if (error) return { error: error.message }
  if (!prop) return { error: "Proposition introuvable" }

  // Nom du CDP : membre AJC lié, sinon nom libre.
  let cdpName: string | null = (prop as any).cdp_custom ?? null
  if ((prop as any).cdp_id) {
    const { data: cdp } = await sb
      .from("personnes")
      .select("prenom, nom")
      .eq("id", (prop as any).cdp_id)
      .single()
    if (cdp) cdpName = `${cdp.prenom ?? ""} ${cdp.nom ?? ""}`.trim() || cdpName
  }

  // Taux de TVA depuis les paramètres (clé/valeur), défaut 20 %.
  let tvaPct = 20
  const { data: tvaParam } = await sb
    .from("parametres")
    .select("value")
    .eq("key", "tva_rate")
    .maybeSingle()
  if (tvaParam?.value != null) {
    const parsed = Number(tvaParam.value)
    if (!Number.isNaN(parsed) && parsed > 0) tvaPct = parsed
  }

  const phases = (((prop as any).proposal_phases as any[]) || [])
    .slice()
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    .map((p) => ({
      name: p.name as string,
      jehCount: Number(p.jeh_count || 0),
      jehPrice: Number(p.jeh_price || 0),
    }))

  // Modalités de règlement (best-effort : colonne ajoutée par la migration 035).
  let modalites: PaiementModalites | null = null
  const { data: modRow, error: modErr } = await sb
    .from("proposals")
    .select("paiement_modalites")
    .eq("id", id)
    .maybeSingle()
  if (!modErr && (modRow as any)?.paiement_modalites) {
    const m = (modRow as any).paiement_modalites
    if (m && Array.isArray(m.versements)) {
      modalites = {
        type: m.type === "pvri" ? "pvri" : "standard",
        versements: m.versements.map((v: any) => ({
          label: String(v.label ?? "Versement"),
          pct: Number(v.pct ?? 0),
        })),
      }
    }
  }

  const detail: ProposalBudgetDetail = {
    id: prop.id as string,
    client_company: (prop as any).client_company ?? null,
    study_type: (prop as any).study_type ?? null,
    cdp_name: cdpName,
    budget_status: (prop as any).budget_status as string,
    budget_comment: (prop as any).budget_comment ?? null,
    budget: {
      phases,
      suiviJehCount: Number((prop as any).suivi_jeh_count || 0),
      suiviJehPrice: Number((prop as any).suivi_jeh_price || 0),
      margeJePct: Number((prop as any).marge_je || 0),
      fraisDossier: Number((prop as any).frais_dossier || 0),
      globalFraisAnnexes: Number((prop as any).global_frais_annexes || 0),
      tvaPct,
      paiementModalites: modalites,
    },
    modalites,
  }
  return { data: detail }
}

// Met à jour les modalités de règlement d'une propale (trésorerie, admin).
// Best-effort : ignore l'absence de colonne (migration 035 non encore appliquée).
export async function updateProposalModalites(
  id: string,
  modalites: PaiementModalites
) {
  if (!(await isCallerAdmin())) return { error: "Non autorisé" }
  const sb = createAdminClient()
  const clean: PaiementModalites = {
    type: modalites?.type === "pvri" ? "pvri" : "standard",
    versements: (modalites?.versements || []).map((v) => ({
      label: String(v.label ?? "Versement"),
      pct: Number(v.pct ?? 0),
    })),
  }
  const { error } = await sb
    .from("proposals")
    .update({ paiement_modalites: clean })
    .eq("id", id)
  if (error && error.code !== "42703") return { error: error.message }
  revalidateTag(PROPOSALS_TAG)
  revalidatePath("/tresorerie")
  return { success: true }
}
