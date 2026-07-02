import { createClient } from "@supabase/supabase-js"
import { loadEnv } from "./lib/load-env"

// NOTE : ce script n'envoie RIEN sans --commit. En dry-run il ne fait que lister.
//
// Usage :
//   Tous les comptes migrés (dry-run)  : npx tsx scripts/send-password-setup.ts
//   Comptes précis (test, dry-run)     : npx tsx scripts/send-password-setup.ts a@x.com b@x.com
//   Envoi réel sur ces comptes précis  : npx tsx scripts/send-password-setup.ts a@x.com b@x.com --commit
//   Envoi réel à TOUS les migrés       : npx tsx scripts/send-password-setup.ts --commit
loadEnv(".env.local")

const COMMIT = process.argv.includes("--commit")
const EMAIL_ARGS = process.argv
  .slice(2)
  .filter((a) => !a.startsWith("--"))
  .map((a) => a.trim().toLowerCase())
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "")

async function main() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Supabase URL / service role key manquants")

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Cible : soit les emails fournis en arguments (test ciblé), soit tous les
  // comptes migrés (legacy_bequick_id non nul).
  let query = admin.from("personnes").select("email, prenom")
  if (EMAIL_ARGS.length) query = query.in("email", EMAIL_ARGS)
  else query = query.not("legacy_bequick_id", "is", null)

  const { data, error } = await query
  if (error) throw error
  const targets = data ?? []

  console.log(
    `Cibles : ${targets.length}` +
      (EMAIL_ARGS.length ? ` (emails fournis : ${EMAIL_ARGS.join(", ")})` : " (tous les comptes migrés)")
  )
  for (const t of targets) console.log(`  - ${t.email}`)

  if (!COMMIT) {
    console.log("\nDRY-RUN : aucun email envoyé. Ajouter --commit pour envoyer.")
    return
  }

  // Import dynamique : les templates/sender vivent côté app.
  const { sendEmail } = await import("../lib/email/send")
  const { passwordSetupEmail } = await import("../lib/email/templates")

  let sent = 0
  for (const t of targets) {
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: t.email as string,
      options: { redirectTo: `${SITE_URL}/auth/callback?next=/reset-password` },
    })
    if (linkErr || !link?.properties?.action_link) {
      console.error(`lien échoué ${t.email}: ${linkErr?.message}`)
      continue
    }
    const tpl = passwordSetupEmail({ prenom: (t.prenom as string) ?? null, link: link.properties.action_link })
    await sendEmail({ to: t.email as string, subject: tpl.subject, html: tpl.html })
    sent++
    if (sent % 50 === 0) console.log(`  ${sent}/${targets.length}`)
  }
  console.log(`\nTerminé : ${sent} emails envoyés.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
