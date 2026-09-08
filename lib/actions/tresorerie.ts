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
  montantParIntervenant,
  nextNumeroBV,
  round2,
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

/** Taille de page PostgREST (`db-max-rows`, 1000 par défaut sur Supabase). */
const TAILLE_PAGE = 1000

/**
 * Lit TOUTES les lignes d'une requête en la paginant via `.range()`.
 *
 * PostgREST plafonne silencieusement le nombre de lignes renvoyées : au-delà
 * du plafond la réponse est tronquée SANS erreur. Pour le suivi des
 * rétributions c'est un contresens financier, pas un détail d'affichage :
 * une page `candidatures` tronquée transforme de vrais intervenants en lignes
 * d'alerte « intervenants non sélectionnés », et une page `retributions`
 * tronquée fait réapparaître comme impayées des personnes déjà réglées (voire
 * les marque orphelines). On boucle donc jusqu'à recevoir une page incomplète.
 *
 * L'appelant DOIT fournir un tri déterministe (`.order("id")`), sinon Postgres
 * peut renvoyer les lignes dans un ordre différent d'une page à l'autre et
 * produire des doublons ou des oublis.
 */
async function chargerToutesLesPages(
  requete: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>
): Promise<{ data: any[]; error: any }> {
  const lignes: any[] = []
  for (let page = 0; ; page++) {
    const from = page * TAILLE_PAGE
    const { data, error } = await requete(from, from + TAILLE_PAGE - 1)
    if (error) return { data: [], error }
    const lot = data ?? []
    lignes.push(...lot)
    if (lot.length < TAILLE_PAGE) return { data: lignes, error: null }
  }
}

const nomComplet = (p: { prenom?: string | null; nom?: string | null } | null | undefined) =>
  p ? [p.prenom, p.nom].filter(Boolean).join(" ").trim() || null : null

/**
 * Charge les deux sources nécessaires au calcul des rétributions :
 * - les intervenants de chaque mission (candidatures acceptées + intervenant
 *   assigné directement, embarqué dans la requête missions) ;
 * - les lignes déjà écrites dans `retributions`.
 *
 * Renvoie `error` quand la lecture des candidatures échoue (sans elle, tout le
 * tableau basculerait à tort en « intervenants non sélectionnés »).
 */
async function chargerSourcesRetributions(
  supabase: ReturnType<typeof createClient>,
  missionsData: any[]
): Promise<{
  intervenantSources: IntervenantSource[]
  retributionRecords: RetributionRecord[]
  retributionsIndisponibles: boolean
  error?: string
}> {
  // Pas de filtre `.in("mission_id", …)` : la requête missions de l'appelant
  // n'est elle-même pas filtrée, donc toutes les candidatures acceptées et
  // toutes les rétributions concernent forcément une mission déjà chargée. Le
  // filtre ne restreindrait rien et ferait grossir l'URL GET d'un UUID par
  // mission (414 Request-URI Too Large passé quelques centaines de missions).
  const aDesMissions = missionsData.length > 0

  const [candidaturesRes, retributionsRes] = await Promise.all([
    // `candidatures` et `retributions` ont chacune deux clés étrangères vers
    // `personnes` (personne_id et created_by) : sans l'indice explicite de
    // contrainte, PostgREST refuse la jointure (PGRST201, embed ambigu).
    aDesMissions
      ? chargerToutesLesPages((from, to) =>
          supabase
            .from("candidatures")
            .select("mission_id, personne_id, personnes!candidatures_personne_id_fkey(id, prenom, nom)")
            .eq("statut", "acceptee")
            .order("id", { ascending: true })
            .range(from, to)
        )
      : Promise.resolve({ data: [] as any[], error: null }),
    aDesMissions
      ? chargerToutesLesPages((from, to) =>
          supabase
            .from("retributions")
            .select(
              "mission_id, personne_id, numero_bv, date_paiement, montant, personnes!retributions_personne_id_fkey(id, prenom, nom)"
            )
            .order("id", { ascending: true })
            .range(from, to)
        )
      : Promise.resolve({ data: [] as any[], error: null }),
  ])

  // Table absente (migration 067 pas encore appliquée) : on continue en mode
  // dégradé — les lignes s'affichent, seul l'enregistrement des paiements
  // individuels est indisponible. La détection des deux codes possibles vit
  // dans `tableRetributionsAbsente` (une seule définition pour tout le module).
  let retributionsIndisponibles = false
  let retributionsData: any[] = []
  if (retributionsRes.error) {
    if (tableRetributionsAbsente(retributionsRes.error)) {
      retributionsIndisponibles = true
    } else {
      return {
        intervenantSources: [],
        retributionRecords: [],
        retributionsIndisponibles: false,
        error: retributionsRes.error.message,
      }
    }
  } else {
    retributionsData = retributionsRes.data ?? []
  }

  if (candidaturesRes.error) {
    return {
      intervenantSources: [],
      retributionRecords: [],
      retributionsIndisponibles,
      error: candidaturesRes.error.message,
    }
  }

  // Intervenants d'une mission = candidatures acceptées + intervenant assigné
  // directement (missions de suivi d'étude). Même règle que
  // listMissionIntervenants dans lib/actions/documents.ts. La personne assignée
  // est embarquée dans la requête missions (`intervenant:personnes!…`) plutôt
  // que relue via un `.in("id", …)` : ce dernier faisait exploser la taille de
  // l'URL GET passé ~220 UUID et avalait son erreur, dégradant silencieusement
  // tous les noms en « Intervenant·e ».
  const intervenantSources: IntervenantSource[] = [
    ...(candidaturesRes.data ?? []).map((c: any) => ({
      mission_id: c.mission_id,
      personne_id: c.personne_id,
      nom: nomComplet(c.personnes) ?? "Intervenant·e",
    })),
    ...missionsData
      .filter((m: any) => m.intervenant_id)
      .map((m: any) => ({
        mission_id: m.id,
        personne_id: m.intervenant_id,
        nom: nomComplet(m.intervenant) ?? "Intervenant·e",
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

  return { intervenantSources, retributionRecords, retributionsIndisponibles }
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

  // `migrationMissing` = migration 024 (factures) absente ou partielle. La page
  // s'en sert pour désactiver « Nouvelle facture » et pointer vers
  // 024_factures_tresorerie.sql : ne JAMAIS le réutiliser pour un autre défaut
  // de schéma, sous peine d'envoyer le trésorier vers le mauvais fichier SQL et
  // de lui retirer la création de factures sans raison. L'absence de la table
  // `retributions` (migration 067) a son propre drapeau,
  // `retributionsIndisponibles`.
  let migrationMissing = false

  // Factures, missions et notes de frais sont indépendantes → on lance les trois
  // requêtes en parallèle (gros gain de latence par rapport à un enchaînement
  // séquentiel).
  const [facturesRes, missionsRes0, notesRes] = await Promise.all([
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
      // `missions` a deux FK vers `personnes` (intervenant_id et created_by) :
      // l'indice de contrainte est obligatoire, sinon PGRST201 (embed ambigu).
      .select(
        "id, nom, etude_id, date_debut, date_fin, date_paiement, numero_bv, intervenant_id, remuneration, nb_jeh, nb_intervenants, etudes(id, numero, nom), intervenant:personnes!missions_intervenant_id_fkey(id, prenom, nom)"
      )
      .order("date_fin", { ascending: false, nullsFirst: false }),
    supabase
      .from("notes_de_frais")
      .select(`
        id, numero_note_de_frais, montant_total, description, fichiers_justificatifs, statut, submitted_at, validated_at,
        intervenant:intervenant_id(prenom, nom),
        mission:mission_id(nom, etudes(numero))
      `)
      .neq("statut", "brouillon")
      .order("submitted_at", { ascending: false }),
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
          "id, nom, etude_id, date_debut, date_fin, intervenant_id, remuneration, nb_jeh, nb_intervenants, etudes(id, numero, nom), intervenant:personnes!missions_intervenant_id_fkey(id, prenom, nom)"
        )
        .order("date_fin", { ascending: false, nullsFirst: false })
      if (fallback.error) return { error: fallback.error.message }
      missionsRes = fallback as unknown as typeof missionsRes
    } else {
      return { error: missionsRes.error.message }
    }
  }

  const missionsData: any[] = missionsRes.data ?? []

  const { intervenantSources, retributionRecords, retributionsIndisponibles, error: sourcesErr } =
    await chargerSourcesRetributions(supabase, missionsData)
  if (sourcesErr) return { error: sourcesErr }

  const missionSources: MissionSource[] = missionsData.map((m: any) => ({
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

  const notes_de_frais = notesRes.data ?? []

  return {
    data: {
      factures,
      retributions,
      retributionsParPersonne,
      notes_de_frais,
      caParEtude,
      migrationMissing,
      // Distinct de `migrationMissing` (migration 024, factures) : ce drapeau
      // ne signale QUE l'absence de la table `retributions` (migration 067).
      // Le suivi reste affiché, seul l'enregistrement d'un paiement individuel
      // est impossible — la création de factures, elle, n'est pas concernée.
      retributionsIndisponibles,
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

// ── Rétributions : versements intervenant par intervenant ───────────────────

/** Message affiché tant que la migration 067 n'a pas été appliquée. */
const ERREUR_MIGRATION_067 =
  "Migration 067 non appliquée : le suivi par intervenant n'est pas encore actif."

const numeroDejaUtilise = (numero: string) =>
  `Le numéro ${numero} est déjà utilisé par un autre bulletin.`

/**
 * Table `retributions` absente : 42P01 vient de Postgres, PGRST205 du cache de
 * schéma PostgREST (même cause, deux codes selon la couche qui refuse).
 */
function tableRetributionsAbsente(error: any): boolean {
  const code = error?.code
  return code === "42P01" || code === "PGRST205"
}

/**
 * Traduit une erreur Postgres en message lisible pour le trésorier.
 *
 * `numero` = le numéro de BV que l'écriture tentait de poser, quand il est
 * unique et connu (saisie unitaire) ; null pour un lot, où plusieurs numéros
 * sont écrits d'un coup.
 */
function messageErreurRetribution(error: any, numero: string | null): string {
  if (tableRetributionsAbsente(error)) return ERREUR_MIGRATION_067
  // 42501 = violation de RLS. La garde applicative `requireVoirFactures` ne
  // vérifie pas l'état du compte, là où les policies d'écriture de la migration
  // 067 exigent `is_compte_actif` : un·e trésorier·ère suspendu·e ou supprimé·e
  // passe la garde et se fait refuser par la base. Message explicite plutôt que
  // le jargon Postgres.
  if (error?.code === "42501") return "Droits insuffisants pour enregistrer ce versement."
  // 23505 = violation d'unicité. L'upsert absorbe déjà le conflit sur
  // (mission_id, personne_id) : il ne reste que l'index partiel
  // `retributions_numero_bv_genere_unique`, perdu par le second trésorier
  // quand deux saisies simultanées calculent le même max + 1.
  if (error?.code === "23505") {
    return numero
      ? numeroDejaUtilise(numero)
      : "Un numéro de bulletin vient d'être attribué à quelqu'un d'autre : réessayez."
  }
  return error?.message ?? "Erreur inconnue"
}

/**
 * Tous les numéros de BV déjà utilisés : côté `retributions` ET côté `missions`
 * (numéros historiques saisis avant le suivi par intervenant). La pagination
 * est indispensable ici : une page tronquée ferait rendre un numéro déjà pris.
 * Si la table `retributions` n'existe pas encore, on se rabat sur les seuls
 * numéros des missions plutôt que d'échouer.
 */
async function chargerNumerosBVUtilises(
  supabase: ReturnType<typeof createClient>
): Promise<{ numeros: string[]; error?: any }> {
  const [retributionsRes, missionsRes] = await Promise.all([
    chargerToutesLesPages((from, to) =>
      supabase
        .from("retributions")
        .select("id, numero_bv")
        .not("numero_bv", "is", null)
        .order("id", { ascending: true })
        .range(from, to)
    ),
    chargerToutesLesPages((from, to) =>
      supabase
        .from("missions")
        .select("id, numero_bv")
        .not("numero_bv", "is", null)
        .order("id", { ascending: true })
        .range(from, to)
    ),
  ])

  if (missionsRes.error) return { numeros: [], error: missionsRes.error }
  if (retributionsRes.error && !tableRetributionsAbsente(retributionsRes.error)) {
    return { numeros: [], error: retributionsRes.error }
  }

  const numeros = [...retributionsRes.data, ...missionsRes.data]
    .map((r: any) => r.numero_bv)
    .filter((n: any): n is string => typeof n === "string" && n.trim() !== "")
  return { numeros }
}

/**
 * Intervenants d'une mission = candidatures acceptées + intervenant assigné
 * directement, dédoublonnés. Même règle que `chargerSourcesRetributions`.
 * Pas de pagination : on ne lit ici qu'une seule mission, très loin du plafond
 * PostgREST.
 */
async function chargerIntervenantsMission(
  supabase: ReturnType<typeof createClient>,
  missionId: string,
  intervenantId: string | null
): Promise<{ ids: string[]; error?: any }> {
  const { data, error } = await supabase
    .from("candidatures")
    .select("personne_id")
    .eq("mission_id", missionId)
    .eq("statut", "acceptee")
  if (error) return { ids: [], error }

  const ids: string[] = []
  for (const c of (data ?? []) as any[]) {
    if (c.personne_id && !ids.includes(c.personne_id)) ids.push(c.personne_id)
  }
  if (intervenantId && !ids.includes(intervenantId)) ids.push(intervenantId)
  return { ids }
}

/**
 * Numéro de BV proposé par défaut : suite de l'année en cours, en tenant compte
 * des numéros déjà utilisés côté rétributions ET côté missions (historique).
 */
export async function getProchainNumeroBV() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }
  const permErr = await requireVoirFactures(user.id)
  if (permErr) return { error: permErr }

  const { numeros, error } = await chargerNumerosBVUtilises(supabase)
  if (error) return { error: messageErreurRetribution(error, null) }
  return { data: nextNumeroBV(numeros, new Date().getFullYear()) }
}

/**
 * Vérifie qu'un numéro de BV n'est pas déjà utilisé : ni par une AUTRE
 * rétribution, ni par une AUTRE mission (`missions.numero_bv` garde la trace
 * des bulletins émis avant le suivi par intervenant, et ces numéros comptent
 * tout autant pour le trésorier). La mission courante est volontairement
 * exclue du contrôle côté `missions` : reprendre sur la ligne de rétribution
 * le numéro hérité de sa propre mission est légitime, pas un doublon.
 */
async function numeroBVLibre(
  supabase: ReturnType<typeof createClient>,
  numero: string,
  missionId: string,
  personneId: string
): Promise<boolean> {
  const [retributionsRes, missionsRes] = await Promise.all([
    supabase.from("retributions").select("mission_id, personne_id").eq("numero_bv", numero),
    supabase.from("missions").select("id").eq("numero_bv", numero).neq("id", missionId),
  ])
  // Simple confort d'affichage : le vrai garde-fou est l'index unique partiel
  // `retributions_numero_bv_genere_unique`. Si une lecture échoue (table
  // absente, RLS…), on laisse l'écriture parler — elle remontera l'erreur
  // traduite plutôt qu'un refus prématuré et inexpliqué.
  if (retributionsRes.error || missionsRes.error) return true
  const prisAilleurs = (retributionsRes.data ?? []).some(
    (r: any) => r.mission_id !== missionId || r.personne_id !== personneId
  )
  return !prisAilleurs && (missionsRes.data ?? []).length === 0
}

/**
 * Enregistre (ou met à jour) le versement dû à UNE personne pour UNE mission.
 *
 * Deux valeurs sont PRÉSERVÉES quand l'appelant ne les fournit pas explicitement
 * (clé absente de l'objet), parce qu'elles constituent la trace comptable :
 * - `numero_bv` : un bulletin déjà émis et transmis ne doit jamais être effacé
 *   par une simple mise à jour de la date de paiement (même règle que
 *   `marquerMissionPaiement` et que le lot `marquerMissionRetributionsPayees`) ;
 * - `montant` : figé à la première écriture, pour que le suivi ne bouge plus si
 *   le barème de la mission change ensuite.
 *
 * L'`upsert` réécrivant la ligne entière, la ligne existante est relue d'abord
 * et ses valeurs servent de repli. Limite assumée : entre cette lecture et
 * l'écriture, une saisie concurrente sur le même couple serait écrasée — même
 * fenêtre que la version précédente (dernier écrivain gagnant), à ceci près
 * qu'on ne perd plus rien en l'absence de concurrence.
 */
export async function marquerRetributionPaiement(input: {
  mission_id: string
  personne_id: string
  date_paiement: string | null
  numero_bv?: string | null
  /** Absent = on conserve le montant figé de la ligne existante. */
  montant?: number
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }
  const permErr = await requireVoirFactures(user.id)
  if (permErr) return { error: permErr }

  // Le montant vient de la ligne affichée côté client : on ne lui fait pas
  // confiance. La colonne porte un CHECK (montant >= 0), mais un message clair
  // vaut mieux qu'une violation de contrainte.
  const montantFourni = input.montant !== undefined
  const montant = Number(input.montant)
  if (montantFourni && (!Number.isFinite(montant) || montant < 0)) {
    return { error: "Montant invalide : la rétribution doit être un nombre positif." }
  }

  const { data: existante, error: lectureErr } = await supabase
    .from("retributions")
    .select("numero_bv, montant")
    .eq("mission_id", input.mission_id)
    .eq("personne_id", input.personne_id)
    .maybeSingle()
  if (lectureErr) return { error: messageErreurRetribution(lectureErr, null) }

  const numeroFourni = input.numero_bv !== undefined
  const numeroSaisi = input.numero_bv?.trim() ? input.numero_bv.trim() : null
  const numero = numeroFourni ? numeroSaisi : (existante as any)?.numero_bv ?? null

  // Le contrôle d'unicité ne porte que sur un numéro réellement saisi : un
  // numéro simplement reconduit depuis la ligne existante est, par
  // construction, déjà le sien.
  if (
    numeroFourni &&
    numeroSaisi &&
    !(await numeroBVLibre(supabase, numeroSaisi, input.mission_id, input.personne_id))
  ) {
    return { error: numeroDejaUtilise(numeroSaisi) }
  }

  const montantFige = (existante as any)?.montant
  if (!montantFourni && montantFige == null) {
    return { error: "Montant manquant : impossible d'enregistrer cette rétribution." }
  }

  const { error } = await supabase.from("retributions").upsert(
    {
      mission_id: input.mission_id,
      personne_id: input.personne_id,
      date_paiement: input.date_paiement,
      numero_bv: numero,
      montant: round2(montantFourni ? montant : Number(montantFige)),
      // L'upsert réécrit la ligne : `created_by` porte donc le·la dernier·ère
      // trésorier·ère ayant enregistré le paiement, pas l'auteur d'origine.
      // Comportement documenté tel quel dans la migration 067.
      created_by: user.id,
    },
    { onConflict: "mission_id,personne_id" }
  )
  if (error) return { error: messageErreurRetribution(error, numeroFourni ? numeroSaisi : null) }

  revalidateTag(MISSIONS_TAG)
  revalidatePath("/tresorerie")
  return { success: true }
}

/**
 * Paiement hérité : mission mono-intervenant réglée AVANT la migration 067, le
 * paiement vit encore sur la ligne `missions` (cf. `buildRetributionRows`).
 * Sans ce repli, annuler une telle ligne ne toucherait aucune rétribution et
 * le tableau continuerait de l'afficher payée. Le numéro de BV de la mission
 * est conservé, seule la date de paiement est effacée.
 * Renvoie un message d'erreur, ou null (repli effectué ou sans objet).
 */
async function annulerPaiementHerite(
  supabase: ReturnType<typeof createClient>,
  missionId: string,
  personneId: string
): Promise<string | null> {
  const { data: mission, error } = await supabase
    .from("missions")
    .select("id, date_paiement, intervenant_id")
    .eq("id", missionId)
    .maybeSingle()
  if (error) return error.message
  if (!mission?.date_paiement) return null

  const { ids, error: intervenantsErr } = await chargerIntervenantsMission(
    supabase,
    missionId,
    (mission as any).intervenant_id ?? null
  )
  if (intervenantsErr) return intervenantsErr.message
  // L'héritage ne vaut que pour une mission à intervenant unique : au-delà,
  // rien ne dit qui a été payé, donc rien à annuler ici.
  if (ids.length !== 1 || ids[0] !== personneId) return null

  // `.select()` obligatoire : la policy "missions write" (migration 050) exige
  // `is_membre_interne`, que ne possède pas un·e trésorier·ère dont le droit
  // `voir_factures` vient d'un poste cumulé. Sans lecture du résultat, l'UPDATE
  // filtré par RLS renvoie zéro ligne SANS erreur et l'annulation serait
  // annoncée comme réussie alors que rien n'a bougé.
  const { data, error: updateErr } = await supabase
    .from("missions")
    .update({ date_paiement: null })
    .eq("id", missionId)
    .select("id")
  if (updateErr) return updateErr.message
  if ((data ?? []).length === 0) {
    return "Paiement non annulé : droits insuffisants ou mission déjà modifiée."
  }
  return null
}

/** Annule le versement d'une rétribution ; le numéro de BV émis est conservé. */
export async function annulerRetributionPaiement(missionId: string, personneId: string) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }
  const permErr = await requireVoirFactures(user.id)
  if (permErr) return { error: permErr }

  // Un UPDATE écarté par RLS renvoie zéro ligne SANS erreur : « aucune ligne
  // modifiée » ne prouve donc PAS qu'il n'existe pas de rétribution. On lit
  // explicitement le couple avant de conclure — sinon un·e trésorier·ère
  // suspendu·e (refusé·e par la policy "retributions update", qui exige
  // `is_compte_actif`) basculerait sur le repli hérité et effacerait
  // `missions.date_paiement` pendant que la vraie ligne reste payée.
  const { data: existante, error: lectureErr } = await supabase
    .from("retributions")
    .select("id")
    .eq("mission_id", missionId)
    .eq("personne_id", personneId)
    .maybeSingle()
  // Table absente (migration 067 pas encore appliquée) : il ne PEUT pas exister
  // de rétribution, donc le seul paiement annulable est celui hérité du niveau
  // mission. On enchaîne sur le repli au lieu de bloquer l'annulation d'un
  // versement saisi avant la migration.
  if (lectureErr && !tableRetributionsAbsente(lectureErr)) {
    return { error: messageErreurRetribution(lectureErr, null) }
  }

  if (existante) {
    const { data, error } = await supabase
      .from("retributions")
      .update({ date_paiement: null })
      .eq("id", (existante as any).id)
      .select("id")
    if (error) return { error: messageErreurRetribution(error, null) }
    if ((data ?? []).length === 0) {
      return { error: "Versement non annulé : droits insuffisants ou ligne déjà modifiée." }
    }
  } else {
    const heriteErr = await annulerPaiementHerite(supabase, missionId, personneId)
    if (heriteErr) return { error: heriteErr }
  }

  revalidateTag(MISSIONS_TAG)
  revalidatePath("/tresorerie")
  return { success: true }
}

/**
 * Marque payés tous les intervenants encore dus d'une mission, un numéro de BV
 * attribué à chacun.
 */
export async function marquerMissionRetributionsPayees(missionId: string, date_paiement: string) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }
  const permErr = await requireVoirFactures(user.id)
  if (permErr) return { error: permErr }

  const { data: mission, error: missionErr } = await supabase
    .from("missions")
    .select("id, remuneration, nb_jeh, intervenant_id, date_paiement")
    .eq("id", missionId)
    .maybeSingle()
  if (missionErr) return { error: missionErr.message }
  if (!mission) return { error: "Mission introuvable." }

  const [intervenantsRes, retributionsRes, numerosRes] = await Promise.all([
    chargerIntervenantsMission(supabase, missionId, (mission as any).intervenant_id ?? null),
    supabase
      .from("retributions")
      .select("personne_id, numero_bv, date_paiement, montant")
      .eq("mission_id", missionId),
    chargerNumerosBVUtilises(supabase),
  ])
  if (intervenantsRes.error) return { error: intervenantsRes.error.message }
  if (retributionsRes.error) {
    return { error: messageErreurRetribution(retributionsRes.error, null) }
  }
  if (numerosRes.error) return { error: messageErreurRetribution(numerosRes.error, null) }

  const existantes = new Map<string, any>(
    ((retributionsRes.data ?? []) as any[]).map((r) => [r.personne_id, r])
  )
  // Même règle d'héritage que `buildRetributionRows` : sur une mission
  // mono-intervenant payée avant la migration 067, la personne est déjà
  // affichée comme payée — le lot ne doit pas la repayer.
  const herite = (id: string) =>
    intervenantsRes.ids.length === 1 && !!(mission as any).date_paiement && !existantes.has(id)

  const aPayer = intervenantsRes.ids.filter(
    (id) => !existantes.get(id)?.date_paiement && !herite(id)
  )
  if (aPayer.length === 0) return { success: true }

  // `montantParIntervenant` ne lit que `remuneration` et `nb_jeh` : inutile de
  // charger le reste de MissionSource (nom, étude, dates…) pour ce calcul.
  const montantCourant = montantParIntervenant({
    remuneration: Number((mission as any).remuneration ?? 0),
    nb_jeh: Number((mission as any).nb_jeh ?? 0),
  })

  const numeros = [...numerosRes.numeros]
  const annee = new Date().getFullYear()
  const lignes = aPayer.map((personne_id) => {
    const existante = existantes.get(personne_id)
    // Un BV déjà émis (ligne créée sans paiement) est réutilisé plutôt que
    // remplacé : on ne brûle pas un numéro et on ne casse pas le bulletin
    // déjà transmis. Sinon on en attribue un neuf, ajouté aussitôt à la liste
    // des numéros pris pour que deux personnes du même lot ne collisionnent
    // pas.
    const dejaEmis = existante?.numero_bv?.trim()
    let numero: string = dejaEmis || ""
    if (!numero) {
      numero = nextNumeroBV(numeros, annee)
      numeros.push(numero)
    }
    // Même logique pour le montant : une ligne existante porte un montant FIGÉ
    // à sa création, c'est lui que le tableau affiche au trésorier. Le
    // recalculer ici ferait diverger le montant enregistré de celui validé à
    // l'écran dès que le barème de la mission a changé entre-temps. Seules les
    // personnes sans ligne prennent le montant courant.
    const montant =
      existante?.montant != null ? round2(Number(existante.montant)) : montantCourant
    return {
      mission_id: missionId,
      personne_id,
      date_paiement,
      numero_bv: numero,
      montant,
      created_by: user.id,
    }
  })

  const { error } = await supabase
    .from("retributions")
    .upsert(lignes, { onConflict: "mission_id,personne_id" })
  if (error) return { error: messageErreurRetribution(error, null) }

  revalidateTag(MISSIONS_TAG)
  revalidatePath("/tresorerie")
  return { success: true }
}
