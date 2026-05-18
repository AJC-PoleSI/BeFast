"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath, revalidateTag, unstable_noStore as noStore } from "next/cache"
import { FACTURES_TAG, ETUDE_DETAIL_TAG } from "@/lib/cache-tags"

// Vérifie que l'utilisateur a la permission voir_factures (ou est admin).
// Retourne null si OK, sinon un objet { error } à propager.
async function assertCanManageFactures(): Promise<{ error: string } | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { data: personne } = await supabase
    .from("personnes")
    .select("profils_types(slug, permissions)")
    .eq("id", user.id)
    .single()

  const profil = (personne as any)?.profils_types
  if (!profil) return { error: "Accès refusé" }
  if (profil.slug === "administrateur") return null
  if (profil.permissions?.voir_factures === true) return null
  return { error: "Accès refusé — permission voir_factures requise" }
}

export type FactureLigneInput = {
  id?: string
  type: "phase" | "frais"
  bloc_id?: string | null
  libelle: string
  montant_total: number
  montant: number
  pourcentage: number
  ordre?: number
}

export type FactureLigne = {
  id: string
  facture_id: string
  type: "phase" | "frais"
  bloc_id: string | null
  libelle: string
  montant_total: number
  montant: number
  pourcentage: number
  ordre: number
  created_at: string
}

export type FactureEtude = {
  id: string
  numero: string
  numero_dans_etude: number | null
  nom: string | null
  montant_ht: number
  date_emission: string | null
  date_echeance: string | null
  date_paiement: string | null
  notes: string | null
  etude_id: string | null
  bloc_id: string | null
  lignes: FactureLigne[]
}

export type PhaseRow = {
  id: string
  nom: string
  jeh: number
  ordre: number
  montant_total: number       // jeh * tarif_jeh
  deja_facture: number        // somme déjà facturée sur les factures existantes
  reste: number               // montant_total - deja_facture
  pourcentage_facture: number // deja_facture / montant_total * 100
}

export type FraisRow = {
  montant_total: number
  deja_facture: number
  reste: number
  pourcentage_facture: number
}

// ============================================================
// LECTURE
// ============================================================

export async function getFacturesEtude(etudeId: string) {
  noStore()
  const denied = await assertCanManageFactures()
  if (denied) return denied
  const supabase = createClient()

  // Étude (pour budget et frais) — sélection résiliente : on essaie d'abord
  // avec budget + marge_pct ; si une colonne manque on retombe sur budget_ht seul.
  let etude: any = null
  let etErr: any = null

  const etRes1 = await supabase
    .from("etudes")
    .select("id, numero, nom, budget_ht, budget, frais_dossier, marge_pct")
    .eq("id", etudeId)
    .single()

  if (etRes1.error && (etRes1.error.code === "42703" || /does not exist/i.test(etRes1.error.message))) {
    // Fallback : essaie uniquement les colonnes garanties
    const etRes2 = await supabase
      .from("etudes")
      .select("id, numero, nom, budget_ht, frais_dossier")
      .eq("id", etudeId)
      .single()
    etude = etRes2.data
    etErr = etRes2.error
  } else {
    etude = etRes1.data
    etErr = etRes1.error
  }
  if (etErr) return { error: etErr.message }

  // Tarif JEH par défaut
  const { data: tarifParam } = await supabase
    .from("parametres")
    .select("value")
    .eq("key", "tarif_jeh_default")
    .maybeSingle()
  const tarifJeh = Number(tarifParam?.value ?? 0) || 0

  // Phases (echeancier_blocs)
  const { data: blocs, error: blErr } = await supabase
    .from("echeancier_blocs")
    .select("id, nom, jeh, ordre")
    .eq("etude_id", etudeId)
    .order("ordre", { ascending: true })
  if (blErr) return { error: blErr.message }

  // Factures de l'étude avec leurs lignes — fallback si facture_lignes n'existe pas encore
  let facturesRaw: any[] = []
  const facturesRes = await supabase
    .from("factures")
    .select("*, facture_lignes(*)")
    .eq("etude_id", etudeId)
    .order("created_at", { ascending: true })

  if (facturesRes.error) {
    // Si c'est une erreur de table manquante ou colonne manquante → fallback sans lignes
    if (
      facturesRes.error.code === "42P01" ||
      facturesRes.error.code === "42703" ||
      /does not exist/i.test(facturesRes.error.message)
    ) {
      // Essaie sans le join facture_lignes
      const fallback = await supabase
        .from("factures")
        .select("id, numero, nom, montant_ht, date_emission, date_echeance, date_paiement, notes, etude_id, bloc_id")
        .eq("etude_id", etudeId)
        .order("created_at", { ascending: true })
      if (!fallback.error) facturesRaw = fallback.data ?? []
      // Si même le fallback échoue, on continue avec une liste vide (pas bloquant)
    } else {
      return { error: facturesRes.error.message }
    }
  } else {
    facturesRaw = facturesRes.data ?? []
  }

  const facturesList: FactureEtude[] = facturesRaw.map((f: any) => ({
    id: f.id,
    numero: f.numero,
    numero_dans_etude: f.numero_dans_etude ?? null,
    nom: f.nom,
    montant_ht: Number(f.montant_ht ?? 0),
    date_emission: f.date_emission,
    date_echeance: f.date_echeance,
    date_paiement: f.date_paiement,
    notes: f.notes,
    etude_id: f.etude_id,
    bloc_id: f.bloc_id,
    lignes: Array.isArray(f.facture_lignes)
      ? f.facture_lignes.sort((a: any, b: any) => a.ordre - b.ordre)
      : [],
  }))

  // Budget HT total de l'étude (fallback si tarifJeh n'est pas configuré).
  // Logique identique à la page étude : base + frais + (base × marge_pct / 100).
  // On garde aussi le fallback sur `budget` au cas où, mais sans planter si absent.
  const base = Number((etude as any).budget_ht ?? (etude as any).budget ?? 0)
  const fraisDossier = Number((etude as any).frais_dossier ?? 0)
  const margePct = Number((etude as any).marge_pct ?? 0)
  const margeEuros = base * (margePct / 100)
  // Total facturable au client = base + marge (les frais sont une ligne séparée)
  const budgetHtEtude = base + margeEuros
  const totalJehEtude = (blocs ?? []).reduce((s: number, b: any) => s + Number(b.jeh ?? 0), 0)

  // Pour chaque phase, calcule le total déjà facturé (somme des lignes phase de toutes les factures)
  // Stratégie pour montant_total :
  //   1) si tarifJeh > 0 et phase.jeh > 0 → phase.jeh * tarifJeh
  //   2) sinon, si budget_ht > 0 et somme(jeh) > 0 → distribue le budget proportionnellement à jeh
  //   3) sinon, si une seule phase et budget_ht > 0 → tout le budget sur cette phase
  //   4) sinon 0 (saisie manuelle)
  const phases: PhaseRow[] = (blocs ?? []).map((b: any) => {
    const jeh = Number(b.jeh ?? 0)
    let montantTotal = 0
    if (tarifJeh > 0 && jeh > 0) {
      montantTotal = jeh * tarifJeh
    } else if (budgetHtEtude > 0 && totalJehEtude > 0 && jeh > 0) {
      montantTotal = Math.round(((jeh / totalJehEtude) * budgetHtEtude) * 100) / 100
    } else if (budgetHtEtude > 0 && (blocs?.length ?? 0) === 1) {
      montantTotal = budgetHtEtude
    }

    const dejaFacture = facturesList.reduce((sum, f) => {
      const ligne = f.lignes.find((l) => l.type === "phase" && l.bloc_id === b.id)
      return sum + (ligne ? Number(ligne.montant) : 0)
    }, 0)
    return {
      id: b.id,
      nom: b.nom,
      jeh,
      ordre: b.ordre ?? 0,
      montant_total: montantTotal,
      deja_facture: dejaFacture,
      reste: Math.max(0, montantTotal - dejaFacture),
      pourcentage_facture: montantTotal > 0 ? (dejaFacture / montantTotal) * 100 : 0,
    }
  })

  // Si aucune phase d'échéancier n'est définie mais budget_ht > 0,
  // on crée une phase virtuelle "Étude" pour permettre la facturation.
  if (phases.length === 0 && budgetHtEtude > 0) {
    const dejaFacture = facturesList.reduce((sum, f) => {
      const ligne = f.lignes.find((l) => l.type === "phase" && l.bloc_id === null)
      return sum + (ligne ? Number(ligne.montant) : 0)
    }, 0)
    phases.push({
      id: "__etude__",
      nom: (etude as any).nom ?? "Étude",
      jeh: 0,
      ordre: 0,
      montant_total: budgetHtEtude,
      deja_facture: dejaFacture,
      reste: Math.max(0, budgetHtEtude - dejaFacture),
      pourcentage_facture: budgetHtEtude > 0 ? (dejaFacture / budgetHtEtude) * 100 : 0,
    })
  }

  // Frais
  const fraisTotal = Number((etude as any).frais_dossier ?? 0)
  const fraisDeja = facturesList.reduce((sum, f) => {
    const ligne = f.lignes.find((l) => l.type === "frais")
    return sum + (ligne ? Number(ligne.montant) : 0)
  }, 0)
  const frais: FraisRow = {
    montant_total: fraisTotal,
    deja_facture: fraisDeja,
    reste: Math.max(0, fraisTotal - fraisDeja),
    pourcentage_facture: fraisTotal > 0 ? (fraisDeja / fraisTotal) * 100 : 0,
  }

  return {
    data: {
      etude,
      tarifJeh,
      phases,
      frais,
      factures: facturesList,
    },
  }
}

export async function getFactureEtudeDetail(factureId: string) {
  noStore()
  const denied = await assertCanManageFactures()
  if (denied) return denied
  const supabase = createClient()

  const { data, error } = await supabase
    .from("factures")
    .select("*, facture_lignes(*)")
    .eq("id", factureId)
    .single()
  if (error) return { error: error.message }

  return {
    data: {
      ...data,
      lignes: (data.facture_lignes ?? []).sort((a: any, b: any) => a.ordre - b.ordre),
    },
  }
}

// ============================================================
// CRÉATION / MISE À JOUR
// ============================================================

async function generateNextNumeroDansEtude(etudeId: string): Promise<number> {
  const supabase = createClient()
  const res = await supabase
    .from("factures")
    .select("numero_dans_etude")
    .eq("etude_id", etudeId)
    .order("numero_dans_etude", { ascending: false, nullsFirst: false })
    .limit(1)
  if (res.error) {
    // Si numero_dans_etude n'existe pas (migration 025 pas appliquée), compte les factures
    if (res.error.code === "42703" || /does not exist/i.test(res.error.message)) {
      const count = await supabase
        .from("factures")
        .select("id", { count: "exact", head: true })
        .eq("etude_id", etudeId)
      return (count.count ?? 0) + 1
    }
  }
  const last = res.data?.[0]?.numero_dans_etude ?? 0
  return (last ?? 0) + 1
}

async function generateGlobalNumero(etudeNumero: string, num: number): Promise<string> {
  return `${etudeNumero}-F${String(num).padStart(2, "0")}`
}

export async function createFactureEtude(input: {
  etude_id: string
  nom?: string | null
  date_emission?: string | null
  date_echeance?: string | null
  date_paiement?: string | null
  notes?: string | null
  lignes: FactureLigneInput[]
}) {
  const denied = await assertCanManageFactures()
  if (denied) return denied
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  // Validation : montants doivent être positifs et finis
  for (const l of input.lignes) {
    if (!Number.isFinite(Number(l.montant)) || Number(l.montant) < 0) {
      return { error: "Montant de ligne invalide" }
    }
    if (!Number.isFinite(Number(l.montant_total)) || Number(l.montant_total) < 0) {
      return { error: "Montant total invalide" }
    }
    if (l.type !== "phase" && l.type !== "frais") {
      return { error: "Type de ligne invalide" }
    }
  }

  // Récupère le numéro d'étude pour générer un numero global
  const { data: et, error: etErr } = await supabase
    .from("etudes")
    .select("numero")
    .eq("id", input.etude_id)
    .single()
  if (etErr) return { error: etErr.message }

  const num = await generateNextNumeroDansEtude(input.etude_id)
  const numeroGlobal = await generateGlobalNumero(et.numero, num)
  const montantHtTotal = input.lignes
    .filter((l) => Number(l.montant) > 0)
    .reduce((s, l) => s + Number(l.montant), 0)

  // Tente l'insert complet ; si numero_dans_etude n'existe pas, retombe sans
  const insertPayload: any = {
    etude_id: input.etude_id,
    numero: numeroGlobal,
    numero_dans_etude: num,
    nom: input.nom ?? "Facture",
    montant_ht: montantHtTotal, // fallback si trigger pas encore en place
    date_emission: input.date_emission ?? null,
    date_echeance: input.date_echeance ?? null,
    date_paiement: input.date_paiement ?? null,
    notes: input.notes ?? null,
    created_by: user.id,
  }

  let factureRes = await supabase.from("factures").insert(insertPayload).select().single()

  if (
    factureRes.error &&
    (factureRes.error.code === "42703" || /numero_dans_etude.*does not exist/i.test(factureRes.error.message))
  ) {
    // Migration 025 pas appliquée → insère sans numero_dans_etude
    const { numero_dans_etude: _ignore, ...withoutNumDansEtude } = insertPayload
    factureRes = await supabase.from("factures").insert(withoutNumDansEtude).select().single()
  }
  if (factureRes.error) return { error: factureRes.error.message }
  const facture = factureRes.data

  // Insère les lignes (filtre celles à 0)
  const lignesToInsert = input.lignes
    .filter((l) => Number(l.montant) > 0)
    .map((l, i) => ({
      facture_id: facture.id,
      type: l.type,
      bloc_id: l.type === "phase" && l.bloc_id && l.bloc_id !== "__etude__" ? l.bloc_id : null,
      libelle: l.libelle,
      montant_total: l.montant_total,
      montant: l.montant,
      pourcentage: l.pourcentage,
      ordre: l.ordre ?? i,
    }))

  if (lignesToInsert.length > 0) {
    const { error: lErr } = await supabase.from("facture_lignes").insert(lignesToInsert)
    if (lErr) {
      // Si la table facture_lignes n'existe pas, ce n'est pas grave : on garde la facture
      // avec son montant_ht agrégé (déjà inséré ci-dessus).
      if (lErr.code === "42P01" || /facture_lignes.*does not exist/i.test(lErr.message)) {
        // Migration 025 pas encore appliquée : on continue sans les lignes
      } else {
        await supabase.from("factures").delete().eq("id", facture.id)
        return { error: lErr.message }
      }
    }
  }

  revalidateTag(FACTURES_TAG)
  revalidateTag(ETUDE_DETAIL_TAG(input.etude_id))
  revalidatePath(`/etudes/${input.etude_id}/factures`)
  revalidatePath(`/tresorerie`)

  return { data: facture }
}

export async function updateFactureEtude(
  factureId: string,
  updates: {
    nom?: string | null
    date_emission?: string | null
    date_echeance?: string | null
    date_paiement?: string | null
    notes?: string | null
    lignes?: FactureLigneInput[]
  }
) {
  const denied = await assertCanManageFactures()
  if (denied) return denied
  const supabase = createClient()

  if (updates.lignes !== undefined) {
    for (const l of updates.lignes) {
      if (!Number.isFinite(Number(l.montant)) || Number(l.montant) < 0) {
        return { error: "Montant de ligne invalide" }
      }
      if (!Number.isFinite(Number(l.montant_total)) || Number(l.montant_total) < 0) {
        return { error: "Montant total invalide" }
      }
      if (l.type !== "phase" && l.type !== "frais") {
        return { error: "Type de ligne invalide" }
      }
    }
  }

  const { data: existing, error: exErr } = await supabase
    .from("factures")
    .select("etude_id")
    .eq("id", factureId)
    .single()
  if (exErr) return { error: exErr.message }

  const headerUpdate: Record<string, any> = {}
  if (updates.nom !== undefined) headerUpdate.nom = updates.nom
  if (updates.date_emission !== undefined) headerUpdate.date_emission = updates.date_emission
  if (updates.date_echeance !== undefined) headerUpdate.date_echeance = updates.date_echeance
  if (updates.date_paiement !== undefined) headerUpdate.date_paiement = updates.date_paiement
  if (updates.notes !== undefined) headerUpdate.notes = updates.notes

  if (Object.keys(headerUpdate).length > 0) {
    const { error } = await supabase.from("factures").update(headerUpdate).eq("id", factureId)
    if (error) return { error: error.message }
  }

  if (updates.lignes !== undefined) {
    const lignesToInsert = updates.lignes
      .filter((l) => Number(l.montant) > 0)
      .map((l, i) => ({
        facture_id: factureId,
        type: l.type,
        bloc_id: l.type === "phase" && l.bloc_id && l.bloc_id !== "__etude__" ? l.bloc_id : null,
        libelle: l.libelle,
        montant_total: l.montant_total,
        montant: l.montant,
        pourcentage: l.pourcentage,
        ordre: l.ordre ?? i,
      }))
    const montantHtTotal = lignesToInsert.reduce((s, l) => s + Number(l.montant), 0)

    // Strategy simple : on supprime tout et on réinsère
    const delRes = await supabase.from("facture_lignes").delete().eq("facture_id", factureId)
    const facture_lignes_missing =
      delRes.error &&
      (delRes.error.code === "42P01" || /facture_lignes.*does not exist/i.test(delRes.error.message))

    if (delRes.error && !facture_lignes_missing) return { error: delRes.error.message }

    if (lignesToInsert.length > 0 && !facture_lignes_missing) {
      const { error: insErr } = await supabase.from("facture_lignes").insert(lignesToInsert)
      if (insErr) {
        if (insErr.code === "42P01" || /facture_lignes.*does not exist/i.test(insErr.message)) {
          // table absente → on met juste à jour le montant_ht de la facture
          await supabase.from("factures").update({ montant_ht: montantHtTotal }).eq("id", factureId)
        } else {
          return { error: insErr.message }
        }
      }
    } else {
      // Pas de lignes (ou table absente) → met à jour directement montant_ht sur la facture
      await supabase.from("factures").update({ montant_ht: montantHtTotal }).eq("id", factureId)
    }
  }

  revalidateTag(FACTURES_TAG)
  if (existing?.etude_id) {
    revalidateTag(ETUDE_DETAIL_TAG(existing.etude_id))
    revalidatePath(`/etudes/${existing.etude_id}/factures`)
  }
  revalidatePath(`/tresorerie`)

  return { success: true }
}

export async function deleteFactureEtude(factureId: string) {
  const denied = await assertCanManageFactures()
  if (denied) return denied
  const supabase = createClient()

  const { data: existing } = await supabase
    .from("factures")
    .select("etude_id")
    .eq("id", factureId)
    .single()

  const { error } = await supabase.from("factures").delete().eq("id", factureId)
  if (error) return { error: error.message }

  revalidateTag(FACTURES_TAG)
  if (existing?.etude_id) {
    revalidateTag(ETUDE_DETAIL_TAG(existing.etude_id))
    revalidatePath(`/etudes/${existing.etude_id}/factures`)
  }
  revalidatePath(`/tresorerie`)
  return { success: true }
}

export async function marquerFactureEtudePaiement(
  factureId: string,
  date_paiement: string | null
) {
  return updateFactureEtude(factureId, { date_paiement })
}

// ============================================================
// IMPRESSION — récupère facture + étude + client + structure
// ============================================================
export async function getFactureForPrint(factureId: string) {
  noStore()
  const denied = await assertCanManageFactures()
  if (denied) return denied
  const supabase = createClient()

  // Facture + lignes (avec fallback si table absente)
  let factureRes = await supabase
    .from("factures")
    .select("*, facture_lignes(*)")
    .eq("id", factureId)
    .single()

  let lignes: any[] = []
  let facture: any = null
  if (factureRes.error) {
    if (
      factureRes.error.code === "42P01" ||
      factureRes.error.code === "42703" ||
      /does not exist/i.test(factureRes.error.message)
    ) {
      const fallback = await supabase
        .from("factures")
        .select("id, numero, nom, montant_ht, date_emission, date_echeance, date_paiement, notes, etude_id")
        .eq("id", factureId)
        .single()
      if (fallback.error) return { error: fallback.error.message }
      facture = fallback.data
    } else {
      return { error: factureRes.error.message }
    }
  } else {
    facture = factureRes.data
    lignes = Array.isArray(factureRes.data?.facture_lignes)
      ? [...factureRes.data.facture_lignes].sort((a: any, b: any) => a.ordre - b.ordre)
      : []
  }

  // Étude + client (résilient sur budget/marge_pct)
  let etudeRes = await supabase
    .from("etudes")
    .select("id, numero, nom, budget_ht, budget, frais_dossier, marge_pct, clients(id, nom, email, telephone)")
    .eq("id", facture.etude_id)
    .single()
  if (etudeRes.error && (etudeRes.error.code === "42703" || /does not exist/i.test(etudeRes.error.message))) {
    etudeRes = await supabase
      .from("etudes")
      .select("id, numero, nom, budget_ht, frais_dossier, clients(id, nom, email, telephone)")
      .eq("id", facture.etude_id)
      .single() as any
  }
  const etude = etudeRes.data ?? null

  // Paramètres structure (raison sociale, adresse, IBAN, etc.)
  const { data: paramsRows } = await supabase.from("parametres").select("key, value")
  const params: Record<string, string> = {}
  for (const row of paramsRows ?? []) {
    params[row.key] = row.value || ""
  }

  return {
    data: {
      facture,
      lignes,
      etude,
      structure: {
        raison_sociale: params.raison_sociale || "",
        adresse: params.adresse || "",
        code_postal: params.code_postal || "",
        ville: params.ville || "",
        siret: params.siret || "",
        iban: params.iban || "",
        bic: params.bic || "",
        email: params.email_structure || params.email || "",
        telephone: params.telephone_structure || params.telephone || "",
        tva_intra: params.tva_intra || "",
        president_nom: params.president_nom || "",
      },
    },
  }
}
