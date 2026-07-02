import { createClient } from "@supabase/supabase-js"
import { loadEnv } from "./lib/load-env"

// NOTE : ce script n'envoie RIEN sans --commit. En dry-run il ne fait que compter.
loadEnv(".env.local")

const COMMIT = process.argv.includes("--commit")
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "")

async function main() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Supabase URL / service role key manquants")

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Cible : uniquement les comptes migrés (legacy_bequick_id non nul).
  const { data, error } = await admin
    .from("personnes")
    .select("email, prenom")
    .not("legacy_bequick_id", "is", null)
  if (error) throw error
  const targets = data ?? []

  console.log(`Cibles (migrés) : ${targets.length}`)
  if (!COMMIT) {
    console.log("DRY-RUN : aucun email envoyé. Relancer avec --commit pour envoyer.")
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
  console.log(`Terminé : ${sent} emails envoyés.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
