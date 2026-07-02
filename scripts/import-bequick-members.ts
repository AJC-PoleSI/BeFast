import { readFileSync, mkdirSync, writeFileSync } from "node:fs"
import { randomBytes } from "node:crypto"
import { parse } from "csv-parse/sync"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { encryptData, generateEncryptionSalt } from "../lib/crypto"
import { loadEnv } from "./lib/load-env"
import { mapRow, dedupeByEmail, type RawRow, type MappedMember } from "./lib/bequick-mapping"

loadEnv(".env.local")

const CSV_PATH = process.argv[2]
const COMMIT = process.argv.includes("--commit")
const SKIP_EXISTING = process.argv.includes("--skip-existing")
const CHECK_EXISTING = process.argv.includes("--check-existing")

if (!CSV_PATH || CSV_PATH.startsWith("--")) {
  console.error('Usage: npx tsx scripts/import-bequick-members.ts "<csv>" [--check-existing] [--commit] [--skip-existing]')
  process.exit(1)
}

function randomPassword(): string {
  // Jamais transmis : sert seulement à satisfaire createUser.
  return randomBytes(24).toString("base64") + "aA1!"
}

// Salt courant (positionné par membre juste avant le chiffrement) + master key,
// initialisés seulement en mode --commit.
let _salt = ""
let _masterKey = ""

function encField(plain: string): { encrypted: string; iv: string; authTag: string } {
  return encryptData(plain, _masterKey, _salt)
}

/** Construit un client service-role (secrets requis). Utilisé par --check-existing et --commit. */
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
  existingId: string | null
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
      // Cas limite : utilisateur auth déjà présent → on le retrouve via personnes.
      const again = await findExisting(admin, m)
      if (!again) throw new Error(`createUser échoué pour ${m.email}: ${error?.message}`)
      userId = again
    } else {
      userId = data.user.id
    }
  }

  // Salt existant ou nouveau (réutilise pour rester déchiffrable après re-run).
  const { data: existing } = await admin.from("personnes").select("encryption_salt").eq("id", userId).maybeSingle()
  _salt = existing?.encryption_salt || generateEncryptionSalt()

  const patch: Record<string, unknown> = {
    email: m.email,
    prenom: m.prenom || null,
    nom: m.nom || null,
    civilite: m.civilite,
    portable: m.portable,
    promo: m.promo,
    competences: m.competences,
    legacy_bequick_id: m.legacyId,
    account_status: m.accountStatus,
    actif: m.actif,
    profil_type_id: roleIds.get(m.roleSlug) ?? null,
    encryption_salt: _salt,
  }
  if (m.nss) { const e = encField(m.nss); patch.nss_encrypted = e.encrypted; patch.nss_iv = e.iv; patch.nss_auth_tag = e.authTag }
  if (m.adresse) { const e = encField(m.adresse); patch.adresse_encrypted = e.encrypted; patch.adresse_iv = e.iv; patch.adresse_auth_tag = e.authTag }
  if (m.ville) { const e = encField(m.ville); patch.ville_encrypted = e.encrypted; patch.ville_iv = e.iv; patch.ville_auth_tag = e.authTag }
  if (m.codePostal) { const e = encField(m.codePostal); patch.code_postal_encrypted = e.encrypted; patch.code_postal_iv = e.iv; patch.code_postal_auth_tag = e.authTag }

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

/** Emails déjà présents sur Be Fast (lecture seule, ne dépend pas de la migration 042). */
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

  // Chevauchement avec les comptes existants sur Be Fast (lecture seule).
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
        : { count: overlap.length, emails: overlap.map((m) => m.email) },
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

  // --- Chemin d'écriture : master key requise ici. ---
  const MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY
  if (!MASTER_KEY || MASTER_KEY.length < 16) throw new Error("ENCRYPTION_MASTER_KEY manquant (min 16)")
  _masterKey = MASTER_KEY

  const admin = makeAdmin()
  console.log(`\nCOMMIT${SKIP_EXISTING ? " (skip-existing)" : ""} : traitement de ${unique.length} membres…`)
  const roleIds = await resolveRoleIds(admin)
  let created = 0
  let updated = 0
  let skipped = 0
  const failures: { email: string; error: string }[] = []
  for (const m of unique) {
    try {
      const existingId = await findExisting(admin, m)
      if (existingId && SKIP_EXISTING) {
        skipped++
        continue
      }
      await upsertMember(admin, m, roleIds, existingId)
      if (existingId) updated++
      else created++
      if ((created + updated) % 50 === 0) console.log(`  ${created + updated}/${unique.length}`)
    } catch (e: any) {
      failures.push({ email: m.email, error: e?.message ?? String(e) })
    }
  }
  console.log(`\nTerminé : ${created} créés, ${updated} mis à jour, ${skipped} ignorés (existants), ${failures.length} échecs.`)
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
