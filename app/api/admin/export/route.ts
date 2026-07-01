export const dynamic = "force-dynamic"

import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireApiAdmin } from "@/lib/auth/api-guards"
import { NextResponse } from "next/server"

// Datasets exportables. `select` est passé tel quel à Supabase ; on aplatit
// ensuite les éventuelles relations imbriquées pour produire un CSV plat.
const DATASETS: Record<string, { table: string; select: string; order?: string }> = {
  membres: { table: "personnes", select: "id, prenom, nom, email, account_status, created_at, profils_types!profil_type_id(nom)", order: "created_at" },
  clients: { table: "clients", select: "id, nom, type, contact_nom, contact_email, contact_phone, actif, created_at", order: "created_at" },
  etudes: { table: "etudes", select: "id, numero, nom, statut, type, budget_ht, date_debut, created_at", order: "created_at" },
  missions: { table: "missions", select: "id, nom, statut, type, classe, nb_jeh, taux_jour, etude_id, created_at", order: "created_at" },
  factures: { table: "factures", select: "id, numero, nom, montant_ht, date_emission, date_echeance, date_paiement, etude_id, created_at", order: "created_at" },
  propositions: { table: "proposals", select: "id, status, budget_status, client_company, study_type, total_ht, total_ttc, created_at", order: "created_at" },
}

function flatten(row: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(row)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      // relation 1-1 (ex: profils_types(nom)) -> on prend ses champs préfixés
      for (const [sk, sv] of Object.entries(v)) out[`${k}_${sk}`] = sv
    } else if (Array.isArray(v)) {
      out[k] = v.map((x) => (typeof x === "object" ? JSON.stringify(x) : x)).join(" | ")
    } else {
      out[k] = v
    }
  }
  return out
}

function toCSV(rows: Record<string, any>[]): string {
  if (rows.length === 0) return ""
  const flat = rows.map(flatten)
  const headers = Array.from(new Set(flat.flatMap((r) => Object.keys(r))))
  const escape = (val: any) => {
    if (val === null || val === undefined) return ""
    const s = String(val)
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.join(";")]
  for (const r of flat) lines.push(headers.map((h) => escape(r[h])).join(";"))
  // BOM pour qu'Excel ouvre l'UTF-8 correctement
  return "﻿" + lines.join("\r\n")
}

export async function GET(request: Request) {
  const type = new URL(request.url).searchParams.get("type") ?? ""
  const ds = DATASETS[type]
  if (!ds) return NextResponse.json({ error: "Type d'export inconnu" }, { status: 400 })

  // Admin uniquement.
  const guard = await requireApiAdmin()
  if (!guard.ok) return guard.response

  const admin = createAdminClient()
  let query = admin.from(ds.table).select(ds.select)
  if (ds.order) query = query.order(ds.order, { ascending: false })
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const csv = toCSV((data as any[]) ?? [])
  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="befast_${type}_${date}.csv"`,
    },
  })
}
