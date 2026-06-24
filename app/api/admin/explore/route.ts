export const dynamic = "force-dynamic"

import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireApiAdmin } from "@/lib/auth/api-guards"
import { NextResponse } from "next/server"

// Tables consultables en lecture seule via l'explorateur (whitelist).
const TABLES: Record<string, { select: string; order?: string }> = {
  personnes: { select: "id, prenom, nom, email, account_status, profil_type_id, created_at", order: "created_at" },
  profils_types: { select: "id, nom, slug, est_defaut" },
  clients: { select: "id, nom, type, contact_nom, contact_email, actif, created_at", order: "created_at" },
  etudes: { select: "id, numero, nom, statut, type, budget_ht, created_at", order: "created_at" },
  missions: { select: "id, nom, statut, type, nb_jeh, etude_id, created_at", order: "created_at" },
  factures: { select: "id, numero, montant_ht, date_paiement, etude_id, created_at", order: "created_at" },
  proposals: { select: "id, status, budget_status, provenance, client_company, taille_entreprise, total_ht, created_at", order: "created_at" },
  parametres: { select: "key, value" },
  marges_recommandees: { select: "taille_entreprise, marge_pct" },
  phases_defaut: { select: "id, nom, jeh_defaut, intervenants_defaut, duree_semaines", order: "id" },
  budget_etude: { select: "id, etude_id, phase, nb_jeh, prix_jeh, marge_pct", order: "created_at" },
}

export async function GET(request: Request) {
  const table = new URL(request.url).searchParams.get("table") ?? ""

  // Admin uniquement.
  const guard = await requireApiAdmin()
  if (!guard.ok) return guard.response

  const admin = createAdminClient()

  // Sans table : on renvoie juste la liste des tables disponibles.
  if (!table) return NextResponse.json({ tables: Object.keys(TABLES) })

  const conf = TABLES[table]
  if (!conf) return NextResponse.json({ error: "Table non autorisée" }, { status: 400 })

  let query = admin.from(table).select(conf.select).limit(500)
  if (conf.order) query = query.order(conf.order, { ascending: false })
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ tables: Object.keys(TABLES), rows: data ?? [] })
}
