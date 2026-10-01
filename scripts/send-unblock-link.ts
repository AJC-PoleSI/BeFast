import { createClient } from "@supabase/supabase-js"
import { randomBytes, createHash } from "crypto"
import { loadEnv } from "./lib/load-env"

// Débloque UN compte resté à la porte (tentatives de réinscription retombées
// sur des liens morts, mot de passe jamais défini…) en lui envoyant un lien
// « définis ton mot de passe ».
//
// Le lien porte un jeton custom (seul son hash est stocké) dont on choisit la
// durée : la route /api/password-reset/verify l'échange à la volée contre une
// session recovery Supabase, ce qui contourne le plafond de 24 h imposé par
// Supabase sur ses propres liens.
//
// NOTE : n'envoie RIEN sans --commit.
//
// Usage (le flag --conditions=react-server est obligatoire : sans lui, le
// `import "server-only"` des modules d'email fait planter tsx) :
//   Dry-run  : npx tsx --conditions=react-server scripts/send-unblock-link.ts prenom.nom@audencia.com
//   Envoi    : npx tsx --conditions=react-server scripts/send-unblock-link.ts prenom.nom@audencia.com --commit
//   Validité : --heures=24 (défaut 24)
//   Domaine  : --site-url=https://... (défaut NEXT_PUBLIC_SITE_URL)

loadEnv(".env.local")

const COMMIT = process.argv.includes("--commit")
const EMAIL = (process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "").trim().toLowerCase()
const HEURES = Math.max(
  1,
  parseInt(process.argv.find((a) => a.startsWith("--heures="))?.slice("--heures=".length) ?? "24", 10) || 24
)
const SITE_URL_ARG = process.argv.find((a) => a.startsWith("--site-url="))?.slice("--site-url=".length)
const SITE_URL = (SITE_URL_ARG || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "")

async function main() {
  if (!EMAIL) throw new Error("Email destinataire manquant.")
  if (!SITE_URL) {
    throw new Error("Domaine inconnu : passe --site-url=https://... ou définis NEXT_PUBLIC_SITE_URL.")
  }
  // Garde-fou : ne jamais envoyer de lien localhost à un vrai destinataire.
  if (/localhost|127\.0\.0\.1/.test(SITE_URL)) {
    throw new Error(`URL du site = ${SITE_URL} : refus d'envoyer un lien localhost.`)
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Supabase URL / service role key manquants")

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await admin
    .from("personnes")
    .select("id, email, prenom, nom, account_status, email_verified")
    .eq("email", EMAIL)
    .limit(1)
  if (error) throw error
  const personne = data?.[0]
  if (!personne) throw new Error(`Aucune personne pour ${EMAIL}`)
  if (personne.account_status === "deleted") {
    throw new Error("Compte supprimé : pas de lien de mot de passe sur un compte neutralisé.")
  }

  const token = randomBytes(32).toString("hex")
  const tokenHash = createHash("sha256").update(token).digest("hex")
  const expiresAt = new Date(Date.now() + HEURES * 60 * 60 * 1000).toISOString()
  const link = `${SITE_URL}/api/password-reset/verify?rt=${token}`

  const { accountUnblockEmail } = await import("../lib/email/templates")
  const tpl = accountUnblockEmail({
    prenom: (personne.prenom as string) ?? null,
    link,
    validiteHeures: HEURES,
  })

  console.log(`Cible    : ${personne.prenom} ${personne.nom} <${personne.email}> (${personne.account_status})`)
  console.log(`Validité : ${HEURES} h — expire le ${expiresAt}`)
  console.log(`Lien     : ${SITE_URL}/api/password-reset/verify?rt=<token>`)
  console.log(`Sujet    : ${tpl.subject}`)

  if (!COMMIT) {
    console.log("\nDRY-RUN : aucun jeton écrit, aucun email envoyé. Ajouter --commit pour envoyer.")
    return
  }

  // Le jeton n'est posé qu'à l'envoi : un dry-run ne doit pas invalider le lien
  // précédent du destinataire.
  const { error: tokErr } = await admin
    .from("personnes")
    .update({ reset_token_hash: tokenHash, reset_token_expires_at: expiresAt })
    .eq("id", personne.id)
  if (tokErr) throw tokErr

  const { sendEmail } = await import("../lib/email/send")
  const res = await sendEmail({ to: personne.email as string, subject: tpl.subject, html: tpl.html })
  if (!res.ok) throw new Error(`Envoi échoué : ${res.error}`)

  console.log("\nEnvoyé.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
