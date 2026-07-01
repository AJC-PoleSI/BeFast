# Rôles & Postes (Phase 1 — Infrastructure) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter des postes (bureau/pôles) cumulables au rôle de base, avec permissions effectives = union, gérables dans l'UI existante `/administration/droits` et assignables par personne.

**Architecture:** On étend le système `profils_types` + `permissions JSONB` existant : une colonne `categorie` classe les entrées (`base`/`bureau`/`pole`), une table de liaison `personne_postes` permet le cumul, et un résolveur pur (`lib/auth/permissions.ts`) calcule l'union base ∪ postes. Le profil en cache charge les postes ; `layout.tsx` et les gardes consomment les permissions effectives.

**Tech Stack:** Next.js App Router (server components + server actions), Supabase (Postgres + RLS, client `service_role`), TypeScript, Vitest (helpers purs), pdf-lib non concerné.

**Référence spec :** `docs/superpowers/specs/2026-07-01-roles-permissions-postes-design.md`

**Périmètre :** Phase 1 = infra + catalogue + 4 permissions d'exemple. La bascule complète des signatures (parametres → postes) et le verrouillage exhaustif des fonctionnalités = Phase 2 (nécessite la liste de Felix).

---

## Prérequis

- Les modifications BA en cours (`lib/signature/ba-pdf.ts`, `ba-utils.ts`, `ba-utils.test.ts`, `app/(dashboard)/administration/documents/page.tsx`) sont terminées et vérifiées mais **non commitées**. Les committer (ou stash) avant de démarrer, pour isoler ce chantier.
- Convention projet : migrations appliquées manuellement via Supabase SQL Editor (fichier dédié + append dans `MIGRATIONS_A_APPLIQUER.sql`). Après toute modif de fichier code, rebuild graphify (voir Task 9).

---

### Task 0: Branche de travail

- [ ] **Step 1: Committer le travail BA en attente puis créer la branche**

```bash
cd /Users/felixpitz/Desktop/Befast
git add lib/signature/ba-pdf.ts lib/signature/ba-utils.ts lib/signature/ba-utils.test.ts "app/(dashboard)/administration/documents/page.tsx"
git commit -m "feat(ba): template BA-2025 à 5 champs AcroForm + mapping (nom_complet, portable, email_audencia, promo, adresse_complete)"
git checkout -b feat/roles-postes-permissions
git add docs/superpowers/specs/2026-07-01-roles-permissions-postes-design.md
git commit -m "docs(roles): spec sous-rôles postes bureau/pôles + permissions"
```

---

### Task 1: Migration SQL — colonne `categorie`, table `personne_postes`, seed des postes AJC

**Files:**
- Create: `supabase/migrations/039_roles_postes.sql`
- Modify: `MIGRATIONS_A_APPLIQUER.sql` (append)

- [ ] **Step 1: Écrire la migration**

Create `supabase/migrations/039_roles_postes.sql` :

```sql
-- 039_roles_postes.sql
-- Sous-rôles AJC : postes (bureau/pôles) cumulés au rôle de base d'une personne.
-- Permissions effectives = rôle_base.permissions ∪ union(postes.permissions).

-- 1) Catégorie sur profils_types : 'base' (rôle unique via personnes.profil_type_id)
--    vs 'bureau'/'pole' (postes cumulables via personne_postes).
ALTER TABLE public.profils_types
  ADD COLUMN IF NOT EXISTS categorie TEXT NOT NULL DEFAULT 'base';

ALTER TABLE public.profils_types
  DROP CONSTRAINT IF EXISTS profils_types_categorie_check;
ALTER TABLE public.profils_types
  ADD CONSTRAINT profils_types_categorie_check
  CHECK (categorie IN ('base','bureau','pole'));

-- 2) Table de liaison personne <-> poste (cumul de plusieurs postes).
CREATE TABLE IF NOT EXISTS public.personne_postes (
  personne_id UUID NOT NULL REFERENCES public.personnes(id) ON DELETE CASCADE,
  poste_id    UUID NOT NULL REFERENCES public.profils_types(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (personne_id, poste_id)
);

ALTER TABLE public.personne_postes ENABLE ROW LEVEL SECURITY;

-- Lecture : l'intéressé voit ses postes ; les admins voient tout.
DROP POLICY IF EXISTS "personne_postes_select" ON public.personne_postes;
CREATE POLICY "personne_postes_select" ON public.personne_postes
  FOR SELECT USING (
    personne_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.personnes p
      JOIN public.profils_types pt ON pt.id = p.profil_type_id
      WHERE p.id = auth.uid() AND pt.slug = 'administrateur'
    )
  );
-- Écriture : aucune policy → refus par défaut sous RLS. Les server actions
-- écrivent via le client service_role (cohérent avec le durcissement RLS 034).

-- 3) Seed des postes AJC (idempotent). Permissions par défaut = uniquement
--    les exemples explicites de Felix ; le reste se règle dans l'UI.
INSERT INTO public.profils_types (nom, slug, permissions, est_defaut, categorie) VALUES
  ('Présidente',                    'presidente',         '{"signer_documents":true,"signer_ba":true,"voir_factures":true}', false, 'bureau'),
  ('Vice-Présidente',               'vice_presidente',    '{}', false, 'bureau'),
  ('Trésorier·ère',                 'tresorier',          '{"signer_documents":true,"voir_factures":true}', false, 'bureau'),
  ('Secrétaire Général',            'secretaire_general', '{}', false, 'bureau'),
  ('Pôle Audit Qualité',            'pole_audit_qualite', '{}', false, 'pole'),
  ('Pôle Développement Commercial', 'pole_dev_co',        '{}', false, 'pole'),
  ('Pôle Ressources Humaines',      'pole_rh',            '{"signer_ba":true,"assigner_intervenants":true}', false, 'pole'),
  ('Pôle Systèmes d''Information',  'pole_si',            '{}', false, 'pole'),
  ('Pôle Marketing',                'pole_marketing',     '{}', false, 'pole')
ON CONFLICT (slug) DO NOTHING;
```

- [ ] **Step 2: Appender le même bloc dans `MIGRATIONS_A_APPLIQUER.sql`**

Ajouter à la fin du fichier une section `-- ===== 039_roles_postes.sql =====` contenant exactement le SQL du Step 1.

- [ ] **Step 3: Vérifier la syntaxe (lecture) et committer**

Relire le SQL (guillemets doublés pour `d''Information`, ordre des colonnes). Pas d'exécution automatique — Felix l'applique via Supabase SQL Editor.

```bash
git add supabase/migrations/039_roles_postes.sql MIGRATIONS_A_APPLIQUER.sql
git commit -m "feat(roles): migration categorie + personne_postes + seed postes AJC"
```

---

### Task 2: Types — nouvelles permissions, `categorie`, postes sur `PersonneWithRole`

**Files:**
- Modify: `types/database.types.ts:1-65`

- [ ] **Step 1: Ajouter les 2 clés de permission**

Dans `PermissionKey` (après `"publier_missions"`) :

```ts
  | "publier_missions"
  | "signer_documents"
  | "signer_ba"
```

- [ ] **Step 2: Ajouter `categorie` à `ProfilType`**

```ts
export type ProfilCategorie = "base" | "bureau" | "pole"

export interface ProfilType {
  id: string
  nom: string
  slug: string
  permissions: Permissions
  est_defaut: boolean
  categorie: ProfilCategorie
  created_at: string
  updated_at: string
}
```

- [ ] **Step 3: Ajouter les postes à `PersonneWithRole`**

```ts
export interface PersonnePoste {
  profils_types: ProfilType | null
}

export interface PersonneWithRole extends Personne {
  profils_types: ProfilType | null
  personne_postes?: PersonnePoste[]
}
```

- [ ] **Step 4: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: peut signaler des erreurs dans `layout.tsx` (emptyPermissions incomplet) et `droits/page.tsx` — corrigées aux Tasks 5 et 7. Vérifier qu'il n'y a **pas** d'erreur dans `types/database.types.ts` lui-même.

- [ ] **Step 5: Commit**

```bash
git add types/database.types.ts
git commit -m "feat(roles): types categorie + postes + permissions signer_documents/signer_ba"
```

---

### Task 3: Résolveur de permissions effectives (TDD)

**Files:**
- Create: `lib/auth/permissions.ts`
- Test: `lib/auth/permissions.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

Create `lib/auth/permissions.test.ts` :

```ts
import { describe, it, expect } from "vitest"
import { resolveEffectivePermissions, hasPermission } from "./permissions"
import type { PersonneWithRole } from "@/types/database.types"

function make(basePerms: any, postes: any[] = [], slug = "membre_agc"): PersonneWithRole {
  return {
    id: "u1", email: "x@a.com", prenom: null, nom: null, portable: null, promo: null,
    adresse: null, ville: null, code_postal: null, pole: null, etablissement: null,
    scolarite: null, date_naissance: null, nss_encrypted: null, iban_encrypted: null,
    encryption_key_version: 1, profil_type_id: "r1", avatar_url: null, actif: true,
    account_status: "validated", rejection_reason: null, rejected_at: null, rejected_by: null,
    created_at: "", updated_at: "",
    profils_types: basePerms
      ? { id: "r1", nom: "Base", slug, permissions: basePerms, est_defaut: true, categorie: "base", created_at: "", updated_at: "" }
      : null,
    personne_postes: postes,
  } as PersonneWithRole
}

describe("resolveEffectivePermissions", () => {
  it("fait l'union du rôle de base et des postes", () => {
    const p = make({ dashboard: true }, [
      { profils_types: { permissions: { signer_ba: true } } },
      { profils_types: { permissions: { assigner_intervenants: true } } },
    ])
    const e = resolveEffectivePermissions(p)
    expect(e.dashboard).toBe(true)
    expect(e.signer_ba).toBe(true)
    expect(e.assigner_intervenants).toBe(true)
    expect(e.voir_factures).toBe(false)
  })

  it("renvoie tout à false pour un profil null", () => {
    expect(resolveEffectivePermissions(null).dashboard).toBe(false)
  })

  it("ignore un poste sans profils_types", () => {
    const p = make({ profil: true }, [{ profils_types: null }])
    expect(resolveEffectivePermissions(p).profil).toBe(true)
  })
})

describe("hasPermission", () => {
  it("l'administrateur a toutes les permissions", () => {
    const p = make({}, [], "administrateur")
    expect(hasPermission(p, "voir_factures")).toBe(true)
  })
  it("un membre sans poste n'a pas signer_ba", () => {
    expect(hasPermission(make({ dashboard: true }), "signer_ba")).toBe(false)
  })
})
```

- [ ] **Step 2: Lancer le test → échec attendu**

Run: `npx vitest run lib/auth/permissions.test.ts`
Expected: FAIL — `resolveEffectivePermissions is not a function` (module absent).

- [ ] **Step 3: Implémenter le résolveur**

Create `lib/auth/permissions.ts` :

```ts
import type { PersonneWithRole, Permissions, PermissionKey } from "@/types/database.types"

/** Toutes les clés de permission connues (source de vérité runtime). */
export const ALL_PERMISSION_KEYS: PermissionKey[] = [
  "dashboard", "profil", "missions", "etudes", "prospection", "statistiques",
  "administration", "membres", "documents", "nouvelle_mission",
  "voir_documents_membres", "assigner_intervenants", "parametres_structure",
  "selectionner_candidats", "valider_comptes", "valider_bv", "voir_factures",
  "gerer_parametres", "publier_etudes", "publier_missions",
  "signer_documents", "signer_ba",
]

/** Objet permissions entièrement à false. */
export function emptyPermissions(): Permissions {
  return Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, false])) as Permissions
}

/**
 * Permissions effectives = OR clé-par-clé du rôle de base et de tous les postes
 * (bureau/pôles) assignés. Un poste ou une source manquante est ignoré sans erreur.
 */
export function resolveEffectivePermissions(profile: PersonneWithRole | null): Permissions {
  const perms = emptyPermissions()
  if (!profile) return perms
  const sources: Array<Partial<Permissions> | null | undefined> = [
    profile.profils_types?.permissions,
    ...(profile.personne_postes ?? []).map((pp) => pp.profils_types?.permissions),
  ]
  for (const src of sources) {
    if (!src) continue
    for (const k of ALL_PERMISSION_KEYS) {
      if ((src as Record<string, unknown>)[k] === true) perms[k] = true
    }
  }
  return perms
}

/** L'administrateur a tout ; sinon on lit les permissions effectives. */
export function hasPermission(profile: PersonneWithRole | null, key: PermissionKey): boolean {
  if (profile?.profils_types?.slug === "administrateur") return true
  return resolveEffectivePermissions(profile)[key] === true
}
```

- [ ] **Step 4: Lancer le test → succès attendu**

Run: `npx vitest run lib/auth/permissions.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/auth/permissions.ts lib/auth/permissions.test.ts
git commit -m "feat(roles): résolveur de permissions effectives (union base + postes) + tests"
```

---

### Task 4: Charger les postes dans le profil en cache

**Files:**
- Modify: `lib/auth/cached-profile.ts:24-30`

- [ ] **Step 1: Étendre la requête**

Remplacer le `.select(...)` :

```ts
      const { data } = await sb
        .from("personnes")
        .select("*, profils_types(*), personne_postes(profils_types(*))")
        .eq("id", uid)
        .single()
      return data as PersonneWithRole | null
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: pas de nouvelle erreur liée à ce fichier.

- [ ] **Step 3: Commit**

```bash
git add lib/auth/cached-profile.ts
git commit -m "feat(roles): cached-profile charge les postes assignés"
```

---

### Task 5: Brancher les permissions effectives (layout + garde API)

**Files:**
- Modify: `app/(dashboard)/layout.tsx:8-65`
- Modify: `lib/auth/api-guards.ts` (ajout d'un garde)

- [ ] **Step 1: Utiliser le résolveur dans le layout**

Dans `app/(dashboard)/layout.tsx` : ajouter l'import et compléter `emptyPermissions` avec les 2 nouvelles clés, puis remplacer le calcul de `permissions`.

Import (près des autres) :
```ts
import { resolveEffectivePermissions } from "@/lib/auth/permissions"
```

Dans l'objet `emptyPermissions`, ajouter après `publier_missions: false,` :
```ts
  signer_documents: false,
  signer_ba: false,
```

Remplacer les lignes 49-54 :
```ts
  const isAdmin = profile?.profils_types?.slug === "administrateur"

  let permissions: Permissions | null = profile
    ? resolveEffectivePermissions(profile)
    : null
```
(La branche « compte non validé » plus bas reste inchangée : elle repart de `emptyPermissions` et ne garde que `profil`/`documents`.)

- [ ] **Step 2: Ajouter un garde API par permission**

Dans `lib/auth/api-guards.ts`, après `requireApiAdmin`, ajouter :

```ts
import { hasPermission } from "@/lib/auth/permissions"
import type { PermissionKey } from "@/types/database.types"

/** Require an authenticated user holding a specific permission (admin bypass). 403 sinon. */
export async function requireApiPermission(key: PermissionKey): Promise<ApiGuardResult> {
  const guard = await requireApiUser()
  if (!guard.ok) return guard
  if (!hasPermission(guard.profile, key)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Non autorisé" }, { status: 403 }),
    }
  }
  return guard
}
```

- [ ] **Step 3: Vérifier compilation + build**

Run: `npx tsc --noEmit && npm run build`
Expected: succès. Les routes `/administration/droits` et le dashboard compilent.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/layout.tsx" lib/auth/api-guards.ts
git commit -m "feat(roles): layout + garde API consomment les permissions effectives"
```

---

### Task 6: Server actions — `categorie` et assignation des postes

**Files:**
- Modify: `lib/actions/members.ts:113-158` (createRole) et en-tête d'imports
- Modify: `lib/actions/members.ts` (nouvelle action `setPersonnePostes`, nouvelle lecture `getPostesCatalog`)

- [ ] **Step 1: `createRole` accepte une `categorie` et seed les nouvelles clés**

Signature :
```ts
export async function createRole(nom: string, slug: string, categorie: "base" | "bureau" | "pole" = "base") {
```
Dans `emptyPerms`, ajouter :
```ts
      signer_documents: false, signer_ba: false,
```
Dans l'`insert`, ajouter `categorie` :
```ts
      .insert({ nom, slug: normalizedSlug, permissions: emptyPerms, est_defaut: false, categorie })
```

- [ ] **Step 2: Ajouter `getPostesCatalog` et `setPersonnePostes`**

À la fin de `lib/actions/members.ts` (vérifier que `revalidateTag` est importé depuis `next/cache` ; sinon l'ajouter) :

```ts
import { revalidateTag } from "next/cache"

/** Liste des postes assignables (bureau + pôles). */
export async function getPostesCatalog(): Promise<{ data: ProfilType[] | null; error: string | null }> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("profils_types")
      .select("*")
      .in("categorie", ["bureau", "pole"])
      .order("categorie")
      .order("nom")
    if (error) return { data: null, error: error.message }
    return { data: data as ProfilType[], error: null }
  } catch (err) {
    console.error("[getPostesCatalog] Exception:", err)
    return { data: null, error: "Erreur serveur" }
  }
}

/** Remplace l'ensemble des postes d'une personne (admin uniquement). */
export async function setPersonnePostes(personneId: string, posteIds: string[]) {
  try {
    const role = await getCallerRole()
    if (role !== "administrateur") return { success: false, error: "Non autorisé" }

    const admin = createAdminClient()

    // Ne garder que des ids réellement bureau/pole (anti-injection).
    let validIds: string[] = []
    if (posteIds.length) {
      const { data: valid } = await admin
        .from("profils_types")
        .select("id")
        .in("id", posteIds)
        .in("categorie", ["bureau", "pole"])
      validIds = (valid ?? []).map((r: { id: string }) => r.id)
    }

    // Remplacement complet.
    await admin.from("personne_postes").delete().eq("personne_id", personneId)
    if (validIds.length) {
      const rows = validIds.map((poste_id) => ({ personne_id: personneId, poste_id }))
      const { error } = await admin.from("personne_postes").insert(rows)
      if (error) return { success: false, error: error.message }
    }

    revalidateTag(`user-profile:${personneId}`)
    return { success: true }
  } catch (err) {
    console.error("[setPersonnePostes] Exception:", err)
    return { success: false, error: "Erreur serveur" }
  }
}
```

- [ ] **Step 3: Vérifier compilation**

Run: `npx tsc --noEmit`
Expected: succès (les appelants de `createRole` avec 2 args restent valides grâce au défaut `categorie`).

- [ ] **Step 4: Commit**

```bash
git add lib/actions/members.ts
git commit -m "feat(roles): createRole+categorie, getPostesCatalog, setPersonnePostes"
```

---

### Task 7: UI `/administration/droits` — catégories + nouvelles permissions

**Files:**
- Modify: `app/(dashboard)/administration/droits/page.tsx`

- [ ] **Step 1: Étendre `PermKey` et `PERM_LABELS`**

Ajouter à `PermKey` (union, l.8-14) : `| "signer_documents" | "signer_ba"`.
Ajouter à `PERM_LABELS` :
```ts
  signer_documents:        { label: "Signer les documents",       description: "Signer les documents classiques (file du bureau)", icon: "draw" },
  signer_ba:               { label: "Signer les bulletins d'adhésion", description: "Signer les BA des nouveaux membres",           icon: "how_to_reg" },
```

- [ ] **Step 2: Grouper la liste des rôles par catégorie**

Remplacer le bloc `{roles.map(role => ( ... ))}` (l.322-347) par un rendu groupé. Ajouter, avant le `return`, un regroupement :

```ts
  const groups: { key: "base" | "bureau" | "pole"; label: string }[] = [
    { key: "base", label: "Rôles de base" },
    { key: "bureau", label: "Bureau" },
    { key: "pole", label: "Pôles" },
  ]
  const rolesByCat = (cat: string) => roles.filter((r) => (r.categorie ?? "base") === cat)
```

Puis, dans le panneau liste, remplacer la boucle plate par :

```tsx
              <div className="p-2 space-y-3">
                {groups.map((g) => {
                  const list = rolesByCat(g.key)
                  if (list.length === 0) return null
                  return (
                    <div key={g.key}>
                      <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">{g.label}</p>
                      {list.map((role) => (
                        <div
                          key={role.id}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-lg group transition-colors cursor-pointer ${
                            selectedRole?.id === role.id ? "bg-[#00236f] text-white" : "text-zinc-700 hover:bg-zinc-100"
                          }`}
                          onClick={() => selectRole(role)}
                        >
                          <span className="text-sm font-medium truncate">{role.nom}</span>
                          {role.slug !== "administrateur" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteTarget(role) }}
                              className={`shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                                selectedRole?.id === role.id ? "hover:bg-white/20 text-white" : "hover:bg-red-100 text-red-500"
                              }`}
                              title="Supprimer ce rôle"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
```

- [ ] **Step 3: Choix de la catégorie à la création**

Dans `CreateModal`, ajouter un state `categorie` et un `<select>` (Rôle de base / Bureau / Pôle), et passer la valeur : changer `onConfirm: (nom, slug) => void` en `onConfirm: (nom, slug, categorie) => void`.

```tsx
  const [categorie, setCategorie] = useState<"base" | "bureau" | "pole">("base")
```
Ajouter avant l'encart bleu :
```tsx
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wide">Catégorie</label>
            <select
              value={categorie}
              onChange={(e) => setCategorie(e.target.value as "base" | "bureau" | "pole")}
              className="w-full px-3 py-2.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
            >
              <option value="base">Rôle de base</option>
              <option value="bureau">Poste — Bureau</option>
              <option value="pole">Poste — Pôle</option>
            </select>
          </div>
```
Bouton créer : `onClick={() => onConfirm(nom, slug, categorie)}`.
Adapter la signature de `handleCreate` dans la page : `async function handleCreate(nom: string, slug: string, categorie: "base" | "bureau" | "pole")` et l'appel `createRole(nom, slug, categorie)`.

- [ ] **Step 4: Vérifier compilation + build**

Run: `npx tsc --noEmit && npm run build`
Expected: succès.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/administration/droits/page.tsx"
git commit -m "feat(roles): UI droits groupée par catégorie + permissions signer_documents/signer_ba"
```

---

### Task 8: UI `/administration/membres` — assigner des postes

**Files:**
- Create: `app/(dashboard)/administration/membres/_components/PostesMultiSelect.tsx`
- Modify: `app/(dashboard)/administration/membres/page.tsx` (intégration)

- [ ] **Step 1: Lire la page membres pour repérer le point d'intégration**

Run: `sed -n '1,60p' "app/(dashboard)/administration/membres/page.tsx"` puis repérer où une personne est éditée (ligne/action de mise à jour d'un membre) et si la page est client (`"use client"`). Noter le nom de la variable de la personne courante.

- [ ] **Step 2: Créer le composant de multi-sélection**

Create `app/(dashboard)/administration/membres/_components/PostesMultiSelect.tsx` :

```tsx
"use client"

import { useEffect, useState } from "react"
import { Loader, Check } from "lucide-react"
import { getPostesCatalog, setPersonnePostes } from "@/lib/actions/members"
import type { ProfilType } from "@/types/database.types"

export function PostesMultiSelect({
  personneId,
  initialPosteIds,
}: {
  personneId: string
  initialPosteIds: string[]
}) {
  const [postes, setPostes] = useState<ProfilType[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set(initialPosteIds))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getPostesCatalog().then((r) => {
      if (r.data) setPostes(r.data)
      setLoading(false)
    })
  }, [])

  function toggle(id: string) {
    setSaved(false)
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function save() {
    setSaving(true)
    const r = await setPersonnePostes(personneId, Array.from(selected))
    setSaving(false)
    if (r.success) setSaved(true)
  }

  if (loading) return <Loader className="w-4 h-4 animate-spin text-zinc-300" />

  const bureau = postes.filter((p) => p.categorie === "bureau")
  const pole = postes.filter((p) => p.categorie === "pole")

  return (
    <div className="space-y-3">
      {[{ label: "Bureau", list: bureau }, { label: "Pôles", list: pole }].map((g) => (
        <div key={g.label}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">{g.label}</p>
          <div className="flex flex-wrap gap-2">
            {g.list.map((p) => {
              const on = selected.has(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    on ? "bg-[#00236f] text-white border-[#00236f]" : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  {p.nom}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
          saved ? "bg-green-100 text-green-700" : "bg-[#00236f] text-white hover:bg-[#1e3a8a]"
        }`}
      >
        {saving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
        {saved ? "Postes enregistrés" : "Enregistrer les postes"}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Intégrer dans la fiche membre**

Dans `app/(dashboard)/administration/membres/page.tsx`, là où les détails d'une personne sont affichés/édités, monter le composant. Les `personne_postes` sont désormais disponibles sur la personne si elle est chargée via `getCachedProfile` ; sinon, passer `initialPosteIds={[]}` (le composant charge le catalogue et l'admin coche). Exemple d'insertion :

```tsx
import { PostesMultiSelect } from "./_components/PostesMultiSelect"
// ...dans le rendu d'une personne sélectionnée :
<PostesMultiSelect
  personneId={personne.id}
  initialPosteIds={(personne.personne_postes ?? [])
    .map((pp: any) => pp.profils_types?.id)
    .filter(Boolean)}
/>
```
Si la requête de liste des membres ne joint pas encore `personne_postes`, ajouter `personne_postes(profils_types(id))` à son `.select(...)`, ou laisser `initialPosteIds={[]}` (fallback fonctionnel).

- [ ] **Step 4: Vérifier compilation + build**

Run: `npx tsc --noEmit && npm run build`
Expected: succès.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/administration/membres/_components/PostesMultiSelect.tsx" "app/(dashboard)/administration/membres/page.tsx"
git commit -m "feat(roles): assignation multi-postes par membre (UI + action)"
```

---

### Task 9: Vérification finale + graphify

- [ ] **Step 1: Suite complète**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc clean, tous les tests passent (dont `permissions.test.ts` et `ba-utils.test.ts`), build OK.

- [ ] **Step 2: Rebuild graphify (obligatoire — CLAUDE.md projet)**

Run: `$(cat graphify-out/.graphify_python) -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"`
Expected: `Rebuilt: N nodes ...`

- [ ] **Step 3: Commit final éventuel**

```bash
git add -A
git commit -m "chore(roles): rebuild graphify après phase 1 rôles/postes" || echo "rien à committer"
```

- [ ] **Step 4: Récapituler à Felix les étapes manuelles**

1. Appliquer `supabase/migrations/039_roles_postes.sql` dans Supabase SQL Editor.
2. Aller dans **Administration → Droits & Profils** : vérifier les 3 groupes (Base / Bureau / Pôles) et ajuster les toggles.
3. Aller dans **Administration → Membres** : assigner Présidente / Trésorier·ère / pôle RH aux bonnes personnes.
4. Fournir la **liste exhaustive Phase 2** (fonctionnalité → poste) pour brancher le reste + basculer les signatures.

---

## Self-review (rempli par l'auteur du plan)

- **Couverture spec :** §3 modèle → Tasks 1-2 ; §4 résolveur → Tasks 3-5 ; §5 catalogue → Tasks 2,3,7 ; §7 UI → Tasks 7-8 ; §8 phasage → périmètre limité Phase 1. §6 signatures = **hors périmètre Phase 1** (assumé, nécessite la liste Felix).
- **Placeholders :** aucun TODO/TBD dans les steps ; le seul point ouvert (catalogue exhaustif) est explicitement Phase 2.
- **Cohérence des types :** `resolveEffectivePermissions`/`hasPermission`/`ALL_PERMISSION_KEYS`/`emptyPermissions` cohérents entre Tasks 3 et 5 ; `PersonnePoste`/`personne_postes` cohérents entre Tasks 2, 4, 8 ; `categorie` cohérent entre migration (Task 1), type (Task 2), actions (Task 6) et UI (Task 7).
