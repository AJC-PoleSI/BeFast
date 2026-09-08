import { NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedProfile } from "@/lib/auth/cached-profile"
import { hasPermission } from "@/lib/auth/permissions"
import { chargerToutesLesPages, tableRetributionsAbsente } from "@/lib/supabase/pagination"

export const dynamic = "force-dynamic"

/**
 * Export comptable : GET /api/tresorerie/export?from=YYYY-MM-DD&to=YYYY-MM-DD&format=xlsx|csv&sheet=factures|bv
 * - xlsx : classeur 2 onglets (Factures, Bulletins de versement)
 * - csv  : un seul jeu de données (`sheet` requis), séparateur ";" + BOM (Excel FR)
 * Filtres : factures sur date_emission, BV sur la date de paiement.
 *
 * L'onglet « Bulletins de versement » liste UNE LIGNE PAR PAIEMENT, à partir de
 * DEUX sources :
 * - source principale : `retributions` (migration 067), le versement y est
 *   attribué nominativement (montant figé à la date du paiement) ;
 * - repli : TOUTES les missions payées (`missions.date_paiement`), qu'elles
 *   aient ou non un `intervenant_id` — la migration 067 n'a repris dans
 *   `retributions` que les missions dotées d'un `intervenant_id`, jamais les
 *   missions payées sans intervenant identifié (voir le reliquat documenté en
 *   fin de 067_retributions_intervenants.sql). Tant que 067 n'est pas
 *   appliquée, `retributions` n'existe pas du tout : ce repli est alors la
 *   SEULE source, y compris pour les paiements mono-intervenant.
 *
 * Anti-doublon : une ligne de repli n'est exclue que si SA PROPRE date
 * (`missions.date_paiement`) figure déjà, pour cette mission, parmi les dates
 * de paiement enregistrées dans `retributions`. Le but est d'éviter de compter
 * deux fois LE MÊME versement, pas de masquer une mission qui a par ailleurs
 * une rétribution payée à une autre date (versement distinct, également réel).
 *
 * Colonne « Provenance » : le montant d'une ligne `retributions` a été
 * réellement versé (figé à l'époque, même si le barème mission a changé
 * depuis) ; le montant d'une ligne de repli est reconstitué à la volée
 * (rémunération × nb JEH courants de la mission) faute d'enregistrement figé.
 */

const nomComplet = (p: { prenom?: string | null; nom?: string | null } | null | undefined) =>
  p ? [p.prenom, p.nom].filter(Boolean).join(" ").trim() : ""

const libelleEtude = (e: { numero?: string | null; nom?: string | null } | null | undefined) =>
  e ? `${e.numero ?? ""} ${e.nom ?? ""}`.trim() : ""

/** Arrondi comptable au centime (évite le bruit flottant de rémunération × JEH). */
const auCentime = (n: number) => Math.round(n * 100) / 100

/** Repli : mission payée dont l'intervenant n'a pas pu être déterminé. */
const INTERVENANT_INCONNU = "(intervenant non renseigné)"

export async function GET(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const profile = await getCachedProfile(user.id)
  const canSee = hasPermission(profile, "voir_factures")
  if (!canSee) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
  }

  const url = new URL(request.url)
  const from = url.searchParams.get("from") || null
  const to = url.searchParams.get("to") || null
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx"
  const sheet = url.searchParams.get("sheet") === "bv" ? "bv" : "factures"

  const dateOk = (d: string | null) => d === null || /^\d{4}-\d{2}-\d{2}$/.test(d)
  if (!dateOk(from) || !dateOk(to)) {
    return NextResponse.json({ error: "Dates invalides (YYYY-MM-DD)" }, { status: 400 })
  }

  const sb = createAdminClient()

  // L'étude est embarquée dans chaque requête plutôt que relue via un second
  // `.in("id", …)` : passé ~220 UUID, ce filtre fait déborder l'URI GET (8 Ko)
  // et l'export perdait silencieusement toutes les colonnes « Étude ».
  const [facturesRes, retributionsRes, missionsRes, datesRetribueesRes] = await Promise.all([
    // ── Factures ────────────────────────────────────────────────────────────
    chargerToutesLesPages((f, t) => {
      let q = sb
        .from("factures")
        .select(
          "id, numero, nom, montant_ht, date_emission, date_echeance, date_paiement, notes, etudes(id, numero, nom)"
        )
      if (from) q = q.gte("date_emission", from)
      if (to) q = q.lte("date_emission", to)
      // `id` en second critère : tri déterministe, sans lequel deux pages
      // peuvent se recouvrir (doublons) ou s'oublier (lignes perdues).
      return q.order("date_emission", { ascending: true }).order("id", { ascending: true }).range(f, t)
    }),
    // ── BV : rétributions nominatives (source principale) ────────────────────
    // `retributions` a deux clés étrangères vers `personnes` (personne_id et
    // created_by) : sans l'indice explicite de contrainte, PostgREST refuse la
    // jointure (PGRST201, embed ambigu). Vers `missions` il n'y en a qu'une,
    // l'embed simple suffit.
    chargerToutesLesPages((f, t) => {
      let q = sb
        .from("retributions")
        .select(
          "id, numero_bv, montant, date_paiement, personnes!retributions_personne_id_fkey(id, prenom, nom), missions(id, nom, nb_jeh, etudes(id, numero, nom))"
        )
        .not("date_paiement", "is", null)
      if (from) q = q.gte("date_paiement", from)
      if (to) q = q.lte("date_paiement", to)
      return q
        .order("date_paiement", { ascending: true })
        .order("id", { ascending: true })
        .range(f, t)
    }),
    // ── BV : repli sur les missions payées (toutes, avec ou sans intervenant) ─
    // Pas de `.is("intervenant_id", null)` ici : avant la migration 067,
    // `retributions` n'existe pas et cette requête est la SEULE source — la
    // filtrer sur `intervenant_id` ferait disparaître tous les paiements
    // mono-intervenant. L'exclusion des missions déjà couvertes par une
    // rétribution nominative se fait plus bas, ligne par date (anti-doublon).
    chargerToutesLesPages((f, t) => {
      let q = sb
        .from("missions")
        .select(
          "id, nom, numero_bv, remuneration, date_paiement, nb_jeh, etudes(id, numero, nom), intervenant:personnes!missions_intervenant_id_fkey(id, prenom, nom)"
        )
        .not("date_paiement", "is", null)
      if (from) q = q.gte("date_paiement", from)
      if (to) q = q.lte("date_paiement", to)
      return q
        .order("date_paiement", { ascending: true })
        .order("id", { ascending: true })
        .range(f, t)
    }),
    // ── Dates déjà couvertes par une rétribution nominative (anti-doublon) ───
    // Une mission peut cumuler un `missions.date_paiement` historique ET une
    // ou plusieurs rétributions nominatives payées à D'AUTRES dates (ex. solde
    // réglé après annulation d'un premier versement via
    // `annulerRetributionPaiement`, qui remet `date_paiement` à null sans
    // supprimer la ligne). On ne doit exclure du repli que LE MÊME paiement,
    // pas toute la mission : d'où un filtre sur `date_paiement IS NOT NULL` et
    // une comparaison par (mission_id, date) plus bas, jamais par mission_id
    // seul.
    chargerToutesLesPages((f, t) =>
      sb
        .from("retributions")
        .select("mission_id, date_paiement")
        .not("date_paiement", "is", null)
        .order("id", { ascending: true })
        .range(f, t)
    ),
  ])

  if (facturesRes.error) {
    return NextResponse.json({ error: facturesRes.error.message }, { status: 500 })
  }
  if (missionsRes.error) {
    return NextResponse.json({ error: missionsRes.error.message }, { status: 500 })
  }
  // Migration 067 pas encore appliquée : mode dégradé, l'onglet ne contient que
  // les paiements historiques. Toute autre erreur reste une 500.
  let retributionsData: any[] = []
  const datesDejaRetribuees = new Map<string, Set<string>>()
  for (const res of [retributionsRes, datesRetribueesRes]) {
    if (res.error && !tableRetributionsAbsente(res.error)) {
      return NextResponse.json({ error: res.error.message }, { status: 500 })
    }
  }
  if (!retributionsRes.error) retributionsData = retributionsRes.data
  if (!datesRetribueesRes.error) {
    for (const r of datesRetribueesRes.data as any[]) {
      const dates = datesDejaRetribuees.get(r.mission_id) ?? new Set<string>()
      dates.add(r.date_paiement)
      datesDejaRetribuees.set(r.mission_id, dates)
    }
  }

  const factureRows = facturesRes.data.map((f: any) => ({
    numero: f.numero,
    nom: f.nom ?? "",
    etude: libelleEtude(f.etudes),
    montant_ht: Number(f.montant_ht ?? 0),
    date_emission: f.date_emission ?? "",
    date_echeance: f.date_echeance ?? "",
    date_paiement: f.date_paiement ?? "",
    statut: f.date_paiement ? "Payée" : "En attente",
    notes: f.notes ?? "",
  }))

  const bulletinRows = [
    ...retributionsData.map((r: any) => ({
      numero_bv: r.numero_bv ?? "",
      intervenant: nomComplet(r.personnes) || INTERVENANT_INCONNU,
      etude: libelleEtude(r.missions?.etudes),
      mission: r.missions?.nom ?? "",
      nb_jeh: Number(r.missions?.nb_jeh ?? 0),
      montant: auCentime(Number(r.montant ?? 0)),
      date_paiement: r.date_paiement ?? "",
      provenance: "Rétribution enregistrée",
    })),
    ...missionsRes.data
      // Anti-doublon date-aware : on n'exclut cette ligne de repli que si SA
      // PROPRE date de paiement est déjà représentée par une rétribution
      // nominative sur la même mission — même paiement, pas juste même
      // mission (cf. commentaire de la requête ci-dessus).
      .filter((m: any) => !datesDejaRetribuees.get(m.id)?.has(m.date_paiement))
      .map((m: any) => ({
        numero_bv: m.numero_bv ?? "",
        intervenant: nomComplet(m.intervenant) || INTERVENANT_INCONNU,
        etude: libelleEtude(m.etudes),
        mission: m.nom ?? "",
        nb_jeh: Number(m.nb_jeh ?? 0),
        // Pas de montant figé pour ce paiement : on le reconstitue à partir du
        // barème COURANT de la mission (rémunération × nb JEH), comme la
        // reprise d'historique de la migration 067. Si le barème a changé
        // depuis le paiement, ce montant n'est pas celui réellement versé —
        // d'où la colonne « Provenance » qui le signale.
        montant: auCentime(Number(m.remuneration ?? 0) * Number(m.nb_jeh ?? 0)),
        date_paiement: m.date_paiement ?? "",
        provenance: "Paiement mission (montant reconstitué)",
      })),
  ].sort((a, b) => String(a.date_paiement).localeCompare(String(b.date_paiement)))

  const periode = `${from ?? "debut"}_${to ?? "aujourdhui"}`

  // ── CSV ────────────────────────────────────────────────────────────────
  if (format === "csv") {
    const rows: Record<string, unknown>[] = sheet === "bv" ? bulletinRows : factureRows
    const headers = rows.length ? Object.keys(rows[0]) : []
    const esc = (v: unknown) => {
      const s = String(v ?? "")
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const csv =
      "﻿" +
      [headers.join(";"), ...rows.map((r) => headers.map((h) => esc(r[h])).join(";"))].join("\n")
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="export-${sheet}_${periode}.csv"`,
      },
    })
  }

  // ── XLSX (2 onglets) ───────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook()
  wb.creator = "BeFast"

  const wsF = wb.addWorksheet("Factures")
  wsF.columns = [
    { header: "Numéro", key: "numero", width: 16 },
    { header: "Intitulé", key: "nom", width: 28 },
    { header: "Étude", key: "etude", width: 28 },
    { header: "Montant HT (€)", key: "montant_ht", width: 16, style: { numFmt: "#,##0.00" } },
    { header: "Émission", key: "date_emission", width: 12 },
    { header: "Échéance", key: "date_echeance", width: 12 },
    { header: "Paiement", key: "date_paiement", width: 12 },
    { header: "Statut", key: "statut", width: 12 },
    { header: "Notes", key: "notes", width: 30 },
  ]
  wsF.addRows(factureRows)

  const wsB = wb.addWorksheet("Bulletins de versement")
  wsB.columns = [
    { header: "N° BV", key: "numero_bv", width: 14 },
    { header: "Intervenant", key: "intervenant", width: 26 },
    { header: "Étude", key: "etude", width: 28 },
    { header: "Mission", key: "mission", width: 28 },
    { header: "Nb JEH", key: "nb_jeh", width: 10 },
    { header: "Montant (€)", key: "montant", width: 16, style: { numFmt: "#,##0.00" } },
    { header: "Date de paiement", key: "date_paiement", width: 16 },
    { header: "Provenance", key: "provenance", width: 32 },
  ]
  wsB.addRows(bulletinRows)

  for (const ws of [wsF, wsB]) {
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }
    ws.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF00236F" },
    }
    ws.views = [{ state: "frozen", ySplit: 1 }]
  }

  const buf = await wb.xlsx.writeBuffer()
  return new NextResponse(Buffer.from(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="export-comptable_${periode}.xlsx"`,
    },
  })
}
