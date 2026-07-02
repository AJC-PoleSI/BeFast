# Import des membres Be Quick → Be Fast — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importer ~657 membres de l'export CSV Be Quick vers Be Fast (auth users + lignes `personnes` avec PII chiffrées et rôles), renommer le rôle `membre_agc`→`membre_ajc`, et construire (sans l'exécuter) le flux email « définir mon mot de passe ».

**Architecture:** Un module de mapping pur et testé (CSV brut → membre normalisé), consommé par un script CLI autonome exécuté via `tsx` (dry-run par défaut, `--commit` pour écrire, idempotent). PII chiffrées avec le même AES-256-GCM que l'app (`lib/crypto.ts`). Une migration SQL ajoute les colonnes legacy + renomme le rôle. Le flux email est un template + un script gated, jamais lancé.

**Tech Stack:** TypeScript, `tsx`, `csv-parse`, Supabase JS (service role), Node `crypto`, Vitest.

**Référence spec:** `docs/superpowers/specs/2026-07-02-import-bequick-members-design.md`

---

## File Structure

- Create: `scripts/lib/bequick-mapping.ts` — fonctions pures de mapping (email, rôle, poste, statut, dedup, détection d'anomalies).
- Create: `scripts/lib/bequick-mapping.test.ts` — tests Vitest du module de mapping.
- Create: `scripts/lib/load-env.ts` — mini-loader `.env.local` (pas de dépendance dotenv).
- Create: `scripts/import-bequick-members.ts` — CLI d'import (dry-run/commit).
- Create: `scripts/send-password-setup.ts` — CLI email « définir mot de passe » (dormant, gated).
- Create: `supabase/migrations/042_import_members_columns.sql` — colonnes legacy + rename rôle.
- Modify: `MIGRATIONS_A_APPLIQUER.sql` — append du bloc 042.
- Modify: `lib/email/templates.ts` — template `passwordSetupEmail`.
- Modify: `app/(dashboard)/missions/[missionId]/page.tsx` — L98 accepter `membre_ajc`.
- Modify: `app/api/tresorerie/validate/route.ts` — `membre_agc`→`membre_ajc`.
- Modify: `app/api/storage/download/route.ts` — `membre_agc`→`membre_ajc`.
- Modify: `app/api/download/[type]/[id]/route.ts` — `membre_agc`→`membre_ajc`.
- Modify: `lib/auth/permissions.test.ts` — slug par défaut `membre_ajc`.
- Modify: `.gitignore` — ignorer `scripts/out/`.
- Modify: `package.json` — devDeps `tsx`, `csv-parse` (via npm i).

---

## Task 1: Dépendances & gitignore

**Files:**
- Modify: `package.json` (via npm)
- Modify: `.gitignore`

- [ ] **Step 1: Installer les dépendances dev**

Run:
```bash
npm install -D tsx csv-parse
```
Expected: `tsx` et `csv-parse` ajoutés à `devDependencies`, exit 0.

- [ ] **Step 2: Ignorer les sorties de script**

Add to `.gitignore` (append at end):
```
# Sorties locales des scripts d'import (peuvent contenir des emails — jamais commité)
scripts/out/
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore(import): add tsx + csv-parse dev deps, ignore scripts/out"
```

---

## Task 2: Migration 042 (colonnes legacy + rename rôle)

**Files:**
- Create: `supabase/migrations/042_import_members_columns.sql`
- Modify: `MIGRATIONS_A_APPLIQUER.sql`

- [ ] **Step 1: Écrire la migration**

Create `supabase/migrations/042_import_members_columns.sql`:
```sql
-- 042_import_members_columns.sql
-- Colonnes de reprise Be Quick + renommage du rôle membre_agc -> membre_ajc.

ALTER TABLE public.personnes
  ADD COLUMN IF NOT EXISTS legacy_bequick_id INTEGER,
  ADD COLUMN IF NOT EXISTS civilite TEXT,
  ADD COLUMN IF NOT EXISTS competences TEXT;

-- Idempotence de l'import : un legacy_bequick_id est unique (quand renseigné).
CREATE UNIQUE INDEX IF NOT EXISTS personnes_legacy_bequick_id_key
  ON public.personnes (legacy_bequick_id)
  WHERE legacy_bequick_id IS NOT NULL;

-- Renommage du rôle de base (slug + libellé). ancien_membre_agc inchangé.
UPDATE public.profils_types
  SET slug = 'membre_ajc', nom = 'Membre AJC'
  WHERE slug = 'membre_agc';

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Append au fichier d'application manuelle**

Append to `MIGRATIONS_A_APPLIQUER.sql` (end of file):
```sql

-- ===================================================================
-- ===== 042_import_members_columns.sql =====
-- Colonnes de reprise Be Quick (legacy_bequick_id, civilite, competences)
-- + renommage du rôle membre_agc -> membre_ajc.
-- ===================================================================

ALTER TABLE public.personnes
  ADD COLUMN IF NOT EXISTS legacy_bequick_id INTEGER,
  ADD COLUMN IF NOT EXISTS civilite TEXT,
  ADD COLUMN IF NOT EXISTS competences TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS personnes_legacy_bequick_id_key
  ON public.personnes (legacy_bequick_id)
  WHERE legacy_bequick_id IS NOT NULL;

UPDATE public.profils_types
  SET slug = 'membre_ajc', nom = 'Membre AJC'
  WHERE slug = 'membre_agc';

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/042_import_members_columns.sql MIGRATIONS_A_APPLIQUER.sql
git commit -m "feat(db): migration 042 — colonnes reprise Be Quick + rename membre_agc->membre_ajc"
```

> ⚠️ Cette migration doit être appliquée sur Supabase (SQL Editor) **avant** de lancer l'import avec `--commit`. Le rename ne casse pas les JWT existants : `app_role` se recalcule à la prochaine connexion.

---

## Task 3: Corriger les références `membre_agc` dans le code

**Files:**
- Modify: `app/(dashboard)/missions/[missionId]/page.tsx:98`
- Modify: `app/api/tresorerie/validate/route.ts:11`
- Modify: `app/api/storage/download/route.ts:37`
- Modify: `app/api/download/[type]/[id]/route.ts:37`
- Modify: `lib/auth/permissions.test.ts:5`

- [ ] **Step 1: `missions/[missionId]/page.tsx`**

Around L98, la condition teste `slug === "membre_agc"`. La remplacer par `membre_ajc` :
```tsx
    slug === "membre_ajc" ||
```
(L92 accepte déjà les deux ; après ce changement, retirer la redondance `membre_agc` de L92 si présente pour ne garder que `membre_ajc`.)

- [ ] **Step 2: `app/api/tresorerie/validate/route.ts`**

```ts
      await requireRole(supabase, ['tresorerie', 'administrateur', 'membre_ajc'] as any)
```

- [ ] **Step 3: `app/api/storage/download/route.ts`**

```ts
  const isPrivileged = role === "administrateur" || role === "tresorerie" || role === "membre_ajc"
```
(Mettre aussi à jour le commentaire L14 `admin/membre_agc` → `admin/membre_ajc`.)

- [ ] **Step 4: `app/api/download/[type]/[id]/route.ts`**

```ts
      const isPrivileged = role === "administrateur" || role === "tresorerie" || role === "membre_ajc"
```

- [ ] **Step 5: `lib/auth/permissions.test.ts`**

```ts
function make(basePerms: any, postes: any[] = [], slug = "membre_ajc"): PersonneWithRole {
```

- [ ] **Step 6: Vérifier — plus aucune référence de code active**

Run (on ne cherche que dans le code applicatif, hors migrations/docs) :
```bash
rg -n "membre_agc" app lib --glob '!node_modules'
```
Expected: aucun résultat. (Les occurrences légitimes restantes — migration 001, bloc 042 `WHERE slug='membre_agc'`, MIGRATIONS_A_APPLIQUER, docs — sont hors de `app/` et `lib/` et donc normales.)

- [ ] **Step 7: typecheck + tests**

Run:
```bash
npx tsc --noEmit && npx vitest run
```
Expected: 0 erreur TS, tests au vert.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(roles): rename membre_agc -> membre_ajc dans le code"
```

---

## Task 4: Module de mapping pur (TDD)

**Files:**
- Create: `scripts/lib/bequick-mapping.ts`
- Test: `scripts/lib/bequick-mapping.test.ts`

- [ ] **Step 1: Écrire les tests d'abord**

Create `scripts/lib/bequick-mapping.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import {
  normalizeEmail,
  mapPoste,
  mapStatus,
  mapRow,
  dedupeByEmail,
  type RawRow,
} from "./bequick-mapping"

function raw(over: Partial<RawRow> = {}): RawRow {
  return {
    id: "1", image_url: "", civilite: "", etat_id: "", etat_nom: "Membres",
    email: "a.b@audencia.com", prenom: "A", nom: "B", adresse: "", ville: "",
    code_postal: "", num_secu: "", portable: "", promo: "", poste_id: "",
    poste_intitule: "Intervenant (BA)", admin_validated: "1", competences: "",
    business_units: "", ...over,
  }
}

describe("normalizeEmail", () => {
  it("trims + lowercases", () => {
    expect(normalizeEmail("  Foo.Bar@Audencia.com ")).toBe("foo.bar@audencia.com")
  })
  it("flags a domain without a dot as malformed", () => {
    expect(normalizeEmail("x@audencialcom")).toBeNull()
  })
  it("flags an address without @ as malformed", () => {
    expect(normalizeEmail("notanemail")).toBeNull()
  })
})

describe("mapPoste", () => {
  it("Intervenant (BA) -> intervenant, no poste", () => {
    expect(mapPoste("Intervenant (BA)")).toEqual({ role: "intervenant", postes: [], unknown: false })
  })
  it("Chef de Projet -> membre_ajc", () => {
    expect(mapPoste("Chef de Projet")).toEqual({ role: "membre_ajc", postes: [], unknown: false })
  })
  it("1A (mandat entrant) -> membre_ajc", () => {
    expect(mapPoste("1A (mandat entrant)")).toEqual({ role: "membre_ajc", postes: [], unknown: false })
  })
  it("Pôle RH -> membre_ajc + pole_rh", () => {
    expect(mapPoste("Pôle RH")).toEqual({ role: "membre_ajc", postes: ["pole_rh"], unknown: false })
  })
  it("Pôle Trésorerie -> membre_ajc + tresorier", () => {
    expect(mapPoste("Pôle Trésorerie")).toEqual({ role: "membre_ajc", postes: ["tresorier"], unknown: false })
  })
  it("Administrateur -> administrateur", () => {
    expect(mapPoste("Administrateur")).toEqual({ role: "administrateur", postes: [], unknown: false })
  })
  it("empty -> intervenant (default)", () => {
    expect(mapPoste("")).toEqual({ role: "intervenant", postes: [], unknown: false })
  })
  it("unknown non-empty -> intervenant but flagged unknown", () => {
    expect(mapPoste("Grand Manitou")).toEqual({ role: "intervenant", postes: [], unknown: true })
  })
})

describe("mapStatus", () => {
  it("Radié -> inactif, pending", () => {
    expect(mapStatus("Radié", "1")).toEqual({ accountStatus: "pending_validation", actif: false })
  })
  it("Candidats -> actif, pending", () => {
    expect(mapStatus("Candidats", "1")).toEqual({ accountStatus: "pending_validation", actif: true })
  })
  it("Membres validated=1 -> validated", () => {
    expect(mapStatus("Membres", "1")).toEqual({ accountStatus: "validated", actif: true })
  })
  it("Membres validated=0 -> pending", () => {
    expect(mapStatus("Membres", "0")).toEqual({ accountStatus: "pending_validation", actif: true })
  })
})

describe("mapRow", () => {
  it("produces a valid member for a normal row", () => {
    const r = mapRow(raw({ id: "42", num_secu: "199", adresse: "1 rue X" }))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.member.legacyId).toBe(42)
      expect(r.member.email).toBe("a.b@audencia.com")
      expect(r.member.roleSlug).toBe("intervenant")
      expect(r.member.nss).toBe("199")
      expect(r.member.adresse).toBe("1 rue X")
    }
  })
  it("returns an anomaly for a malformed email", () => {
    const r = mapRow(raw({ email: "x@audencialcom" }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe("email_malformed")
  })
})

describe("dedupeByEmail", () => {
  it("keeps first occurrence and counts duplicates", () => {
    const rows = [raw({ id: "1" }), raw({ id: "2" }), raw({ id: "3", email: "c@audencia.com" })]
    const members = rows.map(mapRow).flatMap((r) => (r.ok ? [r.member] : []))
    const { unique, duplicates } = dedupeByEmail(members)
    expect(unique).toHaveLength(2)
    expect(duplicates).toHaveLength(1)
    expect(duplicates[0].legacyId).toBe(2)
  })
})
```

- [ ] **Step 2: Lancer les tests → échec attendu**

Run:
```bash
npx vitest run scripts/lib/bequick-mapping.test.ts
```
Expected: FAIL (module `./bequick-mapping` introuvable).

- [ ] **Step 3: Implémenter le module**

Create `scripts/lib/bequick-mapping.ts`:
```ts
// Mapping pur Be Quick (CSV) -> membre normalisé Be Fast. Aucune I/O, testable.

export interface RawRow {
  id: string
  image_url: string
  civilite: string
  etat_id: string
  etat_nom: string
  email: string
  prenom: string
  nom: string
  adresse: string
  ville: string
  code_postal: string
  num_secu: string
  portable: string
  promo: string
  poste_id: string
  poste_intitule: string
  admin_validated: string
  competences: string
  business_units: string
}

export interface MappedMember {
  legacyId: number | null
  email: string
  prenom: string
  nom: string
  civilite: string | null
  portable: string | null
  promo: string | null
  competences: string | null
  nss: string | null
  adresse: string | null
  ville: string | null
  codePostal: string | null
  roleSlug: string
  posteSlugs: string[]
  accountStatus: "validated" | "pending_validation"
  actif: boolean
  posteUnknown: boolean
}

export type MapResult =
  | { ok: true; member: MappedMember }
  | { ok: false; legacyId: number | null; email: string; reason: "email_malformed" }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Renvoie l'email normalisé, ou null si manifestement malformé. */
export function normalizeEmail(raw: string): string | null {
  const e = (raw ?? "").trim().toLowerCase()
  if (!EMAIL_RE.test(e)) return null
  return e
}

const POSTE_MAP: Record<string, { role: string; postes: string[] }> = {
  "administrateur": { role: "administrateur", postes: [] },
  "chef de projet": { role: "membre_ajc", postes: [] },
  "1a (mandat entrant)": { role: "membre_ajc", postes: [] },
  "pôle rh": { role: "membre_ajc", postes: ["pole_rh"] },
  "pôle trésorerie": { role: "membre_ajc", postes: ["tresorier"] },
  "intervenant (ba)": { role: "intervenant", postes: [] },
}

export function mapPoste(posteIntitule: string): { role: string; postes: string[]; unknown: boolean } {
  const key = (posteIntitule ?? "").trim().toLowerCase()
  if (key === "") return { role: "intervenant", postes: [], unknown: false }
  const hit = POSTE_MAP[key]
  if (hit) return { role: hit.role, postes: hit.postes, unknown: false }
  return { role: "intervenant", postes: [], unknown: true }
}

export function mapStatus(
  etatNom: string,
  adminValidated: string
): { accountStatus: "validated" | "pending_validation"; actif: boolean } {
  const etat = (etatNom ?? "").trim().toLowerCase()
  if (etat === "radié") return { accountStatus: "pending_validation", actif: false }
  if (etat === "candidats") return { accountStatus: "pending_validation", actif: true }
  const validated = (adminValidated ?? "").trim() === "1"
  return { accountStatus: validated ? "validated" : "pending_validation", actif: true }
}

function clean(v: string): string | null {
  const t = (v ?? "").trim()
  return t === "" ? null : t
}

export function mapRow(row: RawRow): MapResult {
  const legacyId = /^\d+$/.test((row.id ?? "").trim()) ? parseInt(row.id, 10) : null
  const email = normalizeEmail(row.email)
  if (!email) {
    return { ok: false, legacyId, email: (row.email ?? "").trim(), reason: "email_malformed" }
  }
  const poste = mapPoste(row.poste_intitule)
  const status = mapStatus(row.etat_nom, row.admin_validated)
  return {
    ok: true,
    member: {
      legacyId,
      email,
      prenom: (row.prenom ?? "").trim(),
      nom: (row.nom ?? "").trim(),
      civilite: clean(row.civilite),
      portable: clean(row.portable),
      promo: clean(row.promo),
      competences: clean(row.competences),
      nss: clean(row.num_secu),
      adresse: clean(row.adresse),
      ville: clean(row.ville),
      codePostal: clean(row.code_postal),
      roleSlug: poste.role,
      posteSlugs: poste.postes,
      accountStatus: status.accountStatus,
      actif: status.actif,
      posteUnknown: poste.unknown,
    },
  }
}

/** Dédoublonne par email (garde la 1ʳᵉ occurrence). */
export function dedupeByEmail(members: MappedMember[]): {
  unique: MappedMember[]
  duplicates: MappedMember[]
} {
  const seen = new Set<string>()
  const unique: MappedMember[] = []
  const duplicates: MappedMember[] = []
  for (const m of members) {
    if (seen.has(m.email)) duplicates.push(m)
    else {
      seen.add(m.email)
      unique.push(m)
    }
  }
  return { unique, duplicates }
}
```

- [ ] **Step 4: Lancer les tests → succès attendu**

Run:
```bash
npx vitest run scripts/lib/bequick-mapping.test.ts
```
Expected: PASS (tous les tests verts).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/bequick-mapping.ts scripts/lib/bequick-mapping.test.ts
git commit -m "feat(import): module de mapping Be Quick pur + tests"
```

---

## Task 5: Mini-loader d'environnement

**Files:**
- Create: `scripts/lib/load-env.ts`

- [ ] **Step 1: Implémenter**

Create `scripts/lib/load-env.ts`:
```ts
import { readFileSync, existsSync } from "node:fs"

/**
 * Charge un fichier .env (KEY=VALUE par ligne) dans process.env sans écraser
 * les variables déjà définies. Évite d'ajouter la dépendance dotenv.
 */
export function loadEnv(path = ".env.local"): void {
  if (!existsSync(path)) return
  const content = readFileSync(path, "utf8")
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = val
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/lib/load-env.ts
git commit -m "feat(import): mini-loader .env.local sans dépendance"
```

---

## Task 6: Script d'import (dry-run + commit)

**Files:**
- Create: `scripts/import-bequick-members.ts`

- [ ] **Step 1: Implémenter le script**

Create `scripts/import-bequick-members.ts`:
```ts
import { readFileSync, mkdirSync, writeFileSync } from "node:fs"
import { randomBytes } from "node:crypto"
import { parse } from "csv-parse/sync"
import { createClient } from "@supabase/supabase-js"
import { encryptData, generateEncryptionSalt } from "../lib/crypto"
import { loadEnv } from "./lib/load-env"
import { mapRow, dedupeByEmail, type RawRow, type MappedMember } from "./lib/bequick-mapping"

loadEnv(".env.local")

const CSV_PATH = process.argv[2]
const COMMIT = process.argv.includes("--commit")

if (!CSV_PATH) {
  console.error('Usage: npx tsx scripts/import-bequick-members.ts "<csv>" [--commit]')
  process.exit(1)
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Supabase URL / service role key manquants")
if (!MASTER_KEY || MASTER_KEY.length < 16) throw new Error("ENCRYPTION_MASTER_KEY manquant (min 16)")

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function randomPassword(): string {
  // Jamais transmis : sert seulement à satisfaire createUser.
  return randomBytes(24).toString("base64") + "aA1!"
}

function encField(plain: string): { encrypted: string; iv: string; authTag: string } {
  return encryptData(plain, MASTER_KEY!, salt())
}

// salt courant, positionné par membre juste avant le chiffrement
let _salt = ""
function salt(): string {
  return _salt
}

async function resolveRoleIds(): Promise<Map<string, string>> {
  const { data, error } = await admin.from("profils_types").select("id, slug")
  if (error) throw error
  return new Map((data ?? []).map((r: any) => [r.slug, r.id]))
}

async function findExisting(m: MappedMember): Promise<string | null> {
  if (m.legacyId != null) {
    const { data } = await admin.from("personnes").select("id").eq("legacy_bequick_id", m.legacyId).maybeSingle()
    if (data?.id) return data.id
  }
  const { data } = await admin.from("personnes").select("id").eq("email", m.email).maybeSingle()
  return data?.id ?? null
}

async function upsertMember(m: MappedMember, roleIds: Map<string, string>): Promise<string> {
  let userId = await findExisting(m)

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: m.email,
      email_confirm: true,
      password: randomPassword(),
      user_metadata: { prenom: m.prenom, nom: m.nom },
    })
    if (error || !data.user) {
      // Cas limite : utilisateur auth déjà présent → on le retrouve via personnes.
      const again = await findExisting(m)
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

  return userId!
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
  const unknownPostes: { legacyId: number | null; poste: string }[] = []
  for (const m of unique) {
    byRole[m.roleSlug] = (byRole[m.roleSlug] ?? 0) + 1
    byStatus[m.accountStatus + (m.actif ? "" : " (inactif)")] =
      (byStatus[m.accountStatus + (m.actif ? "" : " (inactif)")] ?? 0) + 1
  }
  for (const r of rows) {
    const mp = mapRow(r)
    if (mp.ok && mp.member.posteUnknown) unknownPostes.push({ legacyId: mp.member.legacyId, poste: r.poste_intitule })
  }

  const report = {
    timestamp: new Date().toISOString(),
    mode: COMMIT ? "COMMIT" : "DRY-RUN",
    totalRows: rows.length,
    toImport: unique.length,
    duplicates: duplicates.map((d) => ({ legacyId: d.legacyId, email: d.email })),
    anomalies: anomalies.map((a) => ({ legacyId: a.legacyId, email: a.email, reason: a.reason })),
    unknownPostes,
    byRole,
    byStatus,
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

  console.log(`\nCOMMIT : import de ${unique.length} membres…`)
  const roleIds = await resolveRoleIds()
  let done = 0
  const failures: { email: string; error: string }[] = []
  for (const m of unique) {
    try {
      await upsertMember(m, roleIds)
      done++
      if (done % 50 === 0) console.log(`  ${done}/${unique.length}`)
    } catch (e: any) {
      failures.push({ email: m.email, error: e?.message ?? String(e) })
    }
  }
  console.log(`\nTerminé : ${done} importés, ${failures.length} échecs.`)
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
```

- [ ] **Step 2: Vérifier le dry-run (aucune écriture)**

Run:
```bash
npx tsc --noEmit
npx tsx scripts/import-bequick-members.ts "$HOME/Downloads/export_etudiants (1).csv"
```
Expected: rapport JSON affiché — `mode: "DRY-RUN"`, `toImport` ≈ 656, `byRole` cohérent (intervenant ~613, membre_ajc ~35, administrateur 9), `duplicates` = 1 (`teo.fayon@audencia.com`), `anomalies` = 1 (`@audencialcom`). **Aucune ligne créée en base.**

- [ ] **Step 3: Contrôle humain du rapport**

Vérifier dans le rapport : la répartition `byRole`/`byStatus`, la liste `unknownPostes` (doit être vide), les `anomalies`. **Ne pas passer à `--commit` tant que ce rapport n'est pas validé par l'utilisateur.**

- [ ] **Step 4: Commit (script uniquement)**

```bash
git add scripts/import-bequick-members.ts
git commit -m "feat(import): script d'import Be Quick (dry-run/commit, idempotent)"
```

---

## Task 7: Flux email « définir mon mot de passe » (dormant)

**Files:**
- Modify: `lib/email/templates.ts`
- Create: `scripts/send-password-setup.ts`

- [ ] **Step 1: Template email**

Add to `lib/email/templates.ts` (après `accountCreatedUserEmail`):
```ts
export function passwordSetupEmail(opts: { prenom: string | null; link: string }) {
  return {
    subject: "Activez votre accès BeFast — définissez votre mot de passe",
    html: brandedEmail({
      title: `Bienvenue sur BeFast${opts.prenom ? ` ${esc(opts.prenom)}` : ""} !`,
      intro:
        "Votre compte a été migré depuis l'ancienne plateforme. Pour y accéder, définissez votre mot de passe en cliquant sur le bouton ci-dessous. Ce lien est personnel et temporaire.",
      ctaLabel: "Définir mon mot de passe",
      ctaUrl: opts.link,
    }),
  }
}
```

- [ ] **Step 2: Script d'envoi gated (dormant)**

Create `scripts/send-password-setup.ts`:
```ts
import { createClient } from "@supabase/supabase-js"
import { loadEnv } from "./lib/load-env"

// NOTE : ce script n'envoie RIEN sans --commit. En dry-run il ne fait que compter.
loadEnv(".env.local")

const COMMIT = process.argv.includes("--commit")
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "")

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
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

  // Import dynamique : les templates/sender vivent côté app (server-only friendly via tsx).
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
```

> ⚠️ `lib/email/send.ts` et `lib/email/templates.ts` importent `server-only`. Sous `tsx` (hors bundle Next), l'import dynamique fonctionne car `server-only` ne throw qu'en contexte client. Vérifier au Step 3 ; si ça throw, la parade est de recopier `sendEmail` en local dans le script (fetch Resend direct). Ne PAS retirer `server-only` des fichiers app.

- [ ] **Step 3: Vérifier le dry-run (aucun envoi)**

Run:
```bash
npx tsc --noEmit
npx tsx scripts/send-password-setup.ts
```
Expected: `Cibles (migrés) : N` puis `DRY-RUN : aucun email envoyé.` — **aucun email parti**. (N=0 tant que l'import n'a pas tourné en `--commit` — c'est normal.)

- [ ] **Step 4: Commit**

```bash
git add lib/email/templates.ts scripts/send-password-setup.ts
git commit -m "feat(import): template + script d'envoi 'définir mot de passe' (dormant, gated)"
```

---

## Task 8: Reconstruire le graphe graphify

**Files:** aucun (outillage projet)

- [ ] **Step 1: Rebuild**

Run:
```bash
$(cat graphify-out/.graphify_python) -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"
```
Expected: `Rebuilt: … nodes` ou `No code-graph topology changes`.

---

## Ordre d'exécution réel (hors code, côté utilisateur)

1. Tasks 1–8 (code + migration écrits, tests verts, dry-run vérifié).
2. Appliquer la **migration 042** sur Supabase (SQL Editor).
3. Lancer l'import en **dry-run**, faire valider le rapport par l'utilisateur.
4. Sur accord explicite : `--commit` l'import.
5. **Plus tard, sur accord explicite séparé** : `send-password-setup.ts --commit`.
