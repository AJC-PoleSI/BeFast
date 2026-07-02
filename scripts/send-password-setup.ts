import { createClient } from "@supabase/supabase-js"
import { loadEnv } from "./lib/load-env"

// NOTE : ce script n'envoie RIEN sans --commit. En dry-run il ne fait que lister.
// Campagne par lots : par défaut on n'envoie qu'aux comptes migrés PAS ENCORE
// contactés (password_setup_sent_at IS NULL), 100 max par exécution.
//
// Usage :
//   Voir le prochain lot (dry-run)     : npx tsx scripts/send-password-setup.ts --site-url=https://dom
//   Test sur des comptes précis        : npx tsx scripts/send-password-setup.ts a@x.com --site-url=https://dom --commit
//   Lot du jour (100 non contactés)    : npx tsx scripts/send-password-setup.ts --site-url=https://dom --commit
//   Lot personnalisé                   : npx tsx scripts/send-password-setup.ts --limit=50 --site-url=https://dom --commit
loadEnv(".env.local")

const COMMIT = process.argv.includes("--commit")
const EMAIL_ARGS = process.argv
  .slice(2)
  .filter((a) => !a.startsWith("--"))
  .map((a) => a.trim().toLowerCase())
// URL de base des liens : --site-url=... prioritaire, sinon NEXT_PUBLIC_SITE_URL.
const SITE_URL_ARG = process.argv.find((a) => a.startsWith("--site-url="))?.slice("--site-url=".length)
const SITE_URL = (SITE_URL_ARG || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "")
// Taille du lot (défaut 100/jour). Ignoré quand des emails précis sont fournis.
const LIMIT_ARG = process.argv.find((a) => a.startsWith("--limit="))?.slice("--limit=".length)
const LIMIT = LIMIT_ARG ? Math.max(1, parseInt(LIMIT_ARG, 10) || 100) : 100

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Supabase URL / service role key manquants")

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Cible : soit les emails fournis en arguments (test ciblé, sans filtre), soit
  // le prochain lot de comptes migrés PAS ENCORE contactés.
  let query = admin.from("personnes").select("id, email, prenom")
  if (EMAIL_ARGS.length) {
    query = query.in("email", EMAIL_ARGS)
  } else {
    query = query
      .not("legacy_bequick_id", "is", null)
      .is("password_setup_sent_at", null)
      .order("nom", { ascending: true })
      .limit(LIMIT)
  }

  const { data, error } = await query
  if (error) throw error
  const targets = data ?? []

  console.log(
    `Cibles : ${targets.length}` +
      (EMAIL_ARGS.length
        ? ` (emails fournis : ${EMAIL_ARGS.join(", ")})`
        : ` (prochain lot de migrés non contactés, limite ${LIMIT})`)
  )
  console.log(`URL des liens : ${SITE_URL}/reset-password`)
  for (const t of targets) console.log(`  - ${t.email}`)

  if (!COMMIT) {
    console.log("\nDRY-RUN : aucun email envoyé. Ajouter --commit pour envoyer.")
    return
  }

  // Garde-fou : ne jamais envoyer de liens localhost à de vrais destinataires.
  if (/localhost|127\.0\.0\.1/.test(SITE_URL)) {
    throw new Error(
      `URL du site = ${SITE_URL} : refus d'envoyer des liens localhost. ` +
        `Passe --site-url=https://ton-domaine ou définis NEXT_PUBLIC_SITE_URL dans .env.local.`
    )
  }

  // Import dynamique : les templates/sender vivent côté app.
  const { sendEmail } = await import("../lib/email/send")
  const { passwordSetupEmail } = await import("../lib/email/templates")

  let sent = 0
  for (const t of targets) {
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: t.email as string,
      options: { redirectTo: `${SITE_URL}/reset-password` },
    })
    if (linkErr || !link?.properties?.action_link) {
      console.error(`lien échoué ${t.email}: ${linkErr?.message}`)
      continue
    }
    const tpl = passwordSetupEmail({ prenom: (t.prenom as string) ?? null, link: link.properties.action_link })
    const res = await sendEmail({ to: t.email as string, subject: tpl.subject, html: tpl.html })
    if (!res.ok) {
      console.error(`envoi échoué ${t.email}: ${res.error}`)
      continue
    }
    // Marque comme contacté (suivi de campagne / évite le renvoi au prochain lot).
    await admin.from("personnes").update({ password_setup_sent_at: new Date().toISOString() }).eq("id", (t as any).id)
    sent++
    if (sent % 50 === 0) console.log(`  ${sent}/${targets.length}`)
    await sleep(250) // throttle : ménage les limites de débit Resend
  }
  console.log(`\nTerminé : ${sent} emails envoyés.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
