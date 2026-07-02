import { readFileSync, mkdirSync, writeFileSync } from "node:fs"
import { randomBytes, createCipheriv } from "node:crypto"
import { parse } from "csv-parse/sync"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { loadEnv } from "./lib/load-env"
import {
  mapRow,
  dedupeByEmail,
  buildPersonnePatch,
  type RawRow,
  type MappedMember,
} from "./lib/bequick-mapping"

loadEnv(".env.local")

const CSV_PATH = process.argv[2]
const COMMIT = process.argv.includes("--commit")
const SKIP_EXISTING = process.argv.includes("--skip-existing")
const CHECK_EXISTING = process.argv.includes("--check-existing")
const LIMIT_ARG = process.argv.find((a) => a.startsWith("--limit="))?.slice("--limit=".length)
const LIMIT = LIMIT_ARG ? Math.max(1, parseInt(LIMIT_ARG, 10) || 0) : Infinity

if (!CSV_PATH || CSV_PATH.startsWith("--")) {
  console.error(
    'Usage: npx tsx scripts/import-bequick-members.ts "<csv>" [--check-existing] [--limit=N] [--commit] [--skip-existing]'
  )
  process.exit(1)
}

function randomPassword(): string {
  // Jamais transmis : sert seulement à satisfaire createUser.
  return randomBytes(24).toString("base64") + "aA1!"
}

// Réplique EXACTE de lib/encryption.ts::encryptToString (celui-ci importe
// "server-only" et ne peut pas être chargé sous tsx). Format « iv:tag:ciphertext »
// (aes-256-gcm, IV 12o, tag 16o, clé = ENCRYPTION_KEY) → decryptFromString le lit.
function encryptToString(plaintext: string): string {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) throw new Error("ENCRYPTION_KEY doit être 64 hex (32 octets)")
  const key = Buffer.from(hex, "hex")
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: 16 })
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("hex")}:${tag.toString("hex")}:${ct.toString("hex")}`
}

function makeAdmin(): SupabaseClient {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Supabase URL / service role key manquants")
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function resolveRoleIds(admin: SupabaseClient): Promise<Map<string, string>> {
  const { data, error } = await admin.from("profils_types").select("id, slug")
  if (error) throw error
  return new Map((data ?? []).map((r: any) => [r.slug, r.id]))
}

async function findExisting(admin: SupabaseClient, m: MappedMember): Promise<string | null> {
  if (m.legacyId != null) {
    const { data } = await admin.from("personnes").select("id").eq("legacy_bequick_id", m.legacyId).maybeSingle()
    if (data?.id) return data.id
  }
  const { data } = await admin.from("personnes").select("id").eq("email", m.email).maybeSingle()
  return data?.id ?? null
}

async function upsertMember(
  admin: SupabaseClient,
  m: MappedMember,
  roleIds: Map<string, string>,
  existingId: string | null,
  encryptNss: (plain: string) => string
): Promise<void> {
  let userId = existingId

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: m.email,
      email_confirm: true,
      password: randomPassword(),
      user_metadata: { prenom: m.prenom, nom: m.nom },
    })
    if (error || !data.user) {
      const again = await findExisting(admin, m)
      if (!again) throw new Error(`createUser échoué pour ${m.email}: ${error?.message}`)
      userId = again
    } else {
      userId = data.user.id
    }
  }

  // Patch = uniquement des colonnes réellement présentes (plaintext + nss_encrypted).
  const patch = buildPersonnePatch(m, roleIds.get(m.roleSlug) ?? null, encryptNss)
  const { error: upErr } = await admin.from("personnes").update(patch).eq("id", userId)
  if (upErr) throw new Error(`update personnes ${m.email}: ${upErr.message}`)

  // Postes : remplacement complet.
  await admin.from("personne_postes").delete().eq("personne_id", userId)
  const posteIds = m.posteSlugs.map((s) => roleIds.get(s)).filter(Boolean) as string[]
  if (posteIds.length) {
    const rows = posteIds.map((poste_id) => ({ personne_id: userId, poste_id }))
    const { error: pErr } = await admin.from("personne_postes").insert(rows)
    if (pErr) throw new Error(`postes ${m.email}: ${pErr.message}`)
  }
}

/** Emails déjà présents sur Be Fast (lecture seule). */
async function fetchExistingEmails(admin: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await admin.from("personnes").select("email")
  if (error) throw error
  return new Set((data ?? []).map((r: any) => (r.email ?? "").toLowerCase()).filter(Boolean))
}

async function main() {
  const csv = readFileSync(CSV_PATH, "utf8")
  const rows = parse(csv, { columns: true, delimiter: ";", skip_empty_lines: true, relax_quotes: true }) as RawRow[]

  const results = rows.map(mapRow)
  const anomalies = results.flatMap((r) => (r.ok ? [] : [r]))
  const okMembers = results.flatMap((r) => (r.ok ? [r.member] : []))
  const { unique, duplicates } = dedupeByEmail(okMembers)

  const byRole: Record<string, number> = {}
  const byStatus: Record<string, number> = {}
  const unknownPostes: { legacyId: number | null }[] = []
  for (const m of unique) {
    byRole[m.roleSlug] = (byRole[m.roleSlug] ?? 0) + 1
    const statusKey = m.accountStatus + (m.actif ? "" : " (inactif)")
    byStatus[statusKey] = (byStatus[statusKey] ?? 0) + 1
    if (m.posteUnknown) unknownPostes.push({ legacyId: m.legacyId })
  }

  let existingEmails: Set<string> | null = null
  let overlap: MappedMember[] = []
  if (CHECK_EXISTING || COMMIT) {
    const admin = makeAdmin()
    existingEmails = await fetchExistingEmails(admin)
    overlap = unique.filter((m) => existingEmails!.has(m.email))
  }

  const report = {
    timestamp: new Date().toISOString(),
    mode: COMMIT ? (SKIP_EXISTING ? "COMMIT (skip-existing)" : "COMMIT") : "DRY-RUN",
    limit: LIMIT === Infinity ? "aucune" : LIMIT,
    totalRows: rows.length,
    toImport: unique.length,
    duplicatesInCsv: duplicates.map((d) => ({ legacyId: d.legacyId, email: d.email })),
    anomalies: anomalies.map((a) => ({ legacyId: a.legacyId, email: a.email, reason: a.reason })),
    unknownPostes,
    byRole,
    byStatus,
    existingOnBeFast:
      existingEmails === null
        ? "(non vérifié — passer --check-existing)"
        : { count: overlap.length, emails: overlap.slice(0, 20).map((m) => m.email) },
  }

  mkdirSync("scripts/out", { recursive: true })
  const outPath = `scripts/out/import-report-${Date.now()}.json`
  writeFileSync(outPath, JSON.stringify(report, null, 2))

  console.log("=== RAPPORT IMPORT BE QUICK ===")
  console.log(JSON.stringify(report, null, 2))
  console.log(`\nRapport écrit : ${outPath}`)

  if (!COMMIT) {
    console.log("\nDRY-RUN : aucune écriture. Relancer avec --commit pour importer.")
    return
  }

  // --- Chemin d'écriture. NSS via le schéma actif (encryptToString / ENCRYPTION_KEY). ---
  const admin = makeAdmin()
  const batch = unique.slice(0, LIMIT === Infinity ? unique.length : LIMIT)
  console.log(`\nCOMMIT${SKIP_EXISTING ? " (skip-existing)" : ""} : traitement de ${batch.length} membres…`)

  const roleIds = await resolveRoleIds(admin)
  let created = 0
  let updated = 0
  let skipped = 0
  const failures: { email: string; error: string }[] = []
  for (const m of batch) {
    try {
      const existingId = await findExisting(admin, m)
      if (existingId && SKIP_EXISTING) {
        skipped++
        continue
      }
      await upsertMember(admin, m, roleIds, existingId, encryptToString)
      if (existingId) updated++
      else created++
      if ((created + updated) % 50 === 0) console.log(`  ${created + updated}/${batch.length}`)
    } catch (e: any) {
      failures.push({ email: m.email, error: e?.message ?? String(e) })
    }
  }
  console.log(`\nTerminé : ${created} créés, ${updated} mis à jour, ${skipped} ignorés, ${failures.length} échecs.`)
  if (failures.length) {
    const failPath = `scripts/out/import-failures-${Date.now()}.json`
    writeFileSync(failPath, JSON.stringify(failures, null, 2))
    console.log(`Échecs écrits : ${failPath}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
