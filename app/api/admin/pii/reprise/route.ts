export const dynamic = "force-dynamic"
export const maxDuration = 300

import "server-only"

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireApiAdmin } from "@/lib/auth/api-guards"
import { reprendrePII, type ModeReprise } from "@/lib/pii/reprise"

/**
 * POST /api/admin/pii/reprise — administrateur uniquement.
 *
 * Chiffre les données personnelles restées en clair dans `personnes`, puis en
 * vide les copies en clair (voir lib/pii/reprise.ts). Tourne ici, en
 * production, parce que c'est là que vit la clé maître : un script lancé
 * depuis un poste avec une autre clé rendrait les valeurs illisibles.
 *
 * Corps : `{ mode: "chiffrer" | "vider", ecrire?: boolean, limite?: number }`.
 * Sans `ecrire: true`, rien n'est écrit. Réponse : des compteurs, jamais de
 * valeur personnelle.
 */
export async function POST(request: Request) {
  const guard = await requireApiAdmin()
  if (!guard.ok) return guard.response

  const body = await request.json().catch(() => ({}))
  const mode = body?.mode as ModeReprise
  if (mode !== "chiffrer" && mode !== "vider") {
    return NextResponse.json({ error: "mode attendu : « chiffrer » ou « vider »." }, { status: 400 })
  }
  const limite = Math.min(Math.max(Number(body?.limite) || 100, 1), 300)

  try {
    const bilan = await reprendrePII(createAdminClient(), { mode, ecrire: body?.ecrire === true, limite })
    console.info("[admin/pii/reprise]", guard.userId, JSON.stringify(bilan))
    return NextResponse.json(bilan)
  } catch (e) {
    console.error("[admin/pii/reprise]", e)
    return NextResponse.json({ error: (e as Error).message }, { status: 409 })
  }
}
