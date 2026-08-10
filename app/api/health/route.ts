import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// ════════════════════════════════════════════════════════════════════
// KEEP-ALIVE SUPABASE (cf. vercel.json → crons)
//
// Sur le plan gratuit, un projet Supabase est mis en pause après ~7 jours
// sans activité. Ce ping quotidien doit donc déclencher une VRAIE requête
// SQL — sinon la base s'endort quand même.
//
// ⚠️ Deux pièges qui ont rendu ce keep-alive inopérant par le passé :
//
//  1. La requête doit être valide. `select("id")` échouait avec
//     « column parametres.id does not exist » (la table a `key` en clé
//     primaire, pas `id`, cf. migration 012). PostgREST rejette ce genre
//     d'erreur depuis son cache de schéma, SANS jamais interroger Postgres :
//     la base ne voyait aucune activité.
//  2. Il faut le client service-role. Le client SSR (clé anon, sans
//     session) est bloqué par la RLS de `parametres` (SELECT réservé à
//     `authenticated`) et ne lit rien d'utile.
//
// force-dynamic : indispensable pour que Next ne pré-rende pas la route au
// build et que Vercel ne serve pas une réponse statique au cron.
// ════════════════════════════════════════════════════════════════════
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  const noStore = { "Cache-Control": "no-store, max-age=0" }

  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from("parametres").select("key").limit(1)

    if (error) {
      console.error("[health] keep-alive Supabase KO:", error)
      return NextResponse.json(
        { status: "error", error: error.message },
        { status: 500, headers: noStore }
      )
    }

    return NextResponse.json(
      { status: "ok", timestamp: new Date().toISOString() },
      { headers: noStore }
    )
  } catch (e) {
    console.error("[health] keep-alive Supabase KO:", e)
    return NextResponse.json(
      { status: "error", error: String(e) },
      { status: 500, headers: noStore }
    )
  }
}
