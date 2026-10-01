import { createClient } from "@supabase/supabase-js"
import { reprendrePII, type ModeReprise } from "../lib/pii/reprise"
import { loadEnv } from "./lib/load-env"

// Reprise des données personnelles restées en clair dans `personnes`, depuis
// un poste (voir lib/pii/reprise.ts). En production, préférer la route
// POST /api/admin/pii/reprise : elle tourne avec la clé maître de prod. Ici,
// la clé est celle du .env.local ; si elle ne relit pas les valeurs déjà
// chiffrées en base, rien n'est écrit.
//
// Usage (le flag --conditions=react-server est obligatoire, cf. server-only) :
//   npx tsx --conditions=react-server scripts/chiffrer-pii-personnes.ts chiffrer|vider [--ecrire] [--limite=100]

loadEnv(".env.local")

async function main() {
  const mode = process.argv[2] as ModeReprise
  if (mode !== "chiffrer" && mode !== "vider") throw new Error("Mode attendu : chiffrer ou vider.")
  const limite = Number(process.argv.find((a) => a.startsWith("--limite="))?.slice(9)) || 100

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !cle) throw new Error("Supabase URL / service role key manquants")
  const admin = createClient(url, cle, { auth: { autoRefreshToken: false, persistSession: false } })

  const bilan = await reprendrePII(admin, { mode, ecrire: process.argv.includes("--ecrire"), limite })
  console.log(JSON.stringify(bilan, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
