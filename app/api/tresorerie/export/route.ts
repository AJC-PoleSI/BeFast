import { NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedProfile } from "@/lib/auth/cached-profile"

export const dynamic = "force-dynamic"

/**
 * Export comptable : GET /api/tresorerie/export?from=YYYY-MM-DD&to=YYYY-MM-DD&format=xlsx|csv&sheet=factures|bv
 * - xlsx : classeur 2 onglets (Factures, Bulletins de versement)
 * - csv  : un seul jeu de données (`sheet` requis), séparateur ";" + BOM (Excel FR)
 * Filtres : factures sur date_emission, BV sur missions.date_paiement.
 */
export async function GET(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const profile = await getCachedProfile(user.id)
  const isAdmin = profile?.profils_types?.slug === "administrateur"
  const canSee = isAdmin || profile?.profils_types?.permissions?.voir_factures === true
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

  // ── Factures ──────────────────────────────────────────────────────────
  let fq = sb
    .from("factures")
    .select("numero, nom, montant_ht, date_emission, date_echeance, date_paiement, notes, etude_id")
    .order("date_emission", { ascending: true })
  if (from) fq = fq.gte("date_emission", from)
  if (to) fq = fq.lte("date_emission", to)
  const { data: factures, error: fErr } = await fq
  if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 })

  // ── Bulletins de versement (missions payées) ──────────────────────────
  let mq = sb
    .from("missions")
    .select("numero_bv, remuneration, date_paiement, intervenant_id, etude_id, nb_jeh")
    .not("numero_bv", "is", null)
    .order("date_paiement", { ascending: true })
  if (from) mq = mq.gte("date_paiement", from)
  if (to) mq = mq.lte("date_paiement", to)
  const { data: bvRows, error: mErr } = await mq
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })

  // Lookups études + intervenants en 2 requêtes (pas de jointure fragile).
  const etudeIds = Array.from(
    new Set([...(factures || []), ...(bvRows || [])].map((r: any) => r.etude_id).filter(Boolean))
  )
  const intervenantIds = Array.from(
    new Set((bvRows || []).map((r: any) => r.intervenant_id).filter(Boolean))
  )
  const [etudesRes, persRes] = await Promise.all([
    etudeIds.length
      ? sb.from("etudes").select("id, numero, nom").in("id", etudeIds)
      : Promise.resolve({ data: [] as any[] }),
    intervenantIds.length
      ? sb.from("personnes").select("id, prenom, nom").in("id", intervenantIds)
      : Promise.resolve({ data: [] as any[] }),
  ])
  const etudeById = new Map((etudesRes.data || []).map((e: any) => [e.id, e]))
  const persById = new Map((persRes.data || []).map((p: any) => [p.id, p]))

  const factureRows = (factures || []).map((f: any) => {
    const e = etudeById.get(f.etude_id)
    return {
      numero: f.numero,
      nom: f.nom ?? "",
      etude: e ? `${e.numero ?? ""} ${e.nom ?? ""}`.trim() : "",
      montant_ht: Number(f.montant_ht ?? 0),
      date_emission: f.date_emission ?? "",
      date_echeance: f.date_echeance ?? "",
      date_paiement: f.date_paiement ?? "",
      statut: f.date_paiement ? "Payée" : "En attente",
      notes: f.notes ?? "",
    }
  })

  const bulletinRows = (bvRows || []).map((m: any) => {
    const e = etudeById.get(m.etude_id)
    const p = persById.get(m.intervenant_id)
    return {
      numero_bv: m.numero_bv,
      intervenant: p ? `${p.prenom ?? ""} ${p.nom ?? ""}`.trim() : "",
      etude: e ? `${e.numero ?? ""} ${e.nom ?? ""}`.trim() : "",
      nb_jeh: Number(m.nb_jeh ?? 0),
      remuneration: Number(m.remuneration ?? 0),
      date_paiement: m.date_paiement ?? "",
    }
  })

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
    { header: "Nb JEH", key: "nb_jeh", width: 10 },
    { header: "Rétribution (€)", key: "remuneration", width: 16, style: { numFmt: "#,##0.00" } },
    { header: "Date de paiement", key: "date_paiement", width: 16 },
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
