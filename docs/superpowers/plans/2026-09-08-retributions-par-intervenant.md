# Rétributions par intervenant (Trésorerie) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Suivre le paiement des rétributions intervenant par intervenant (au lieu de mission par mission) dans l'onglet Trésorerie, avec numéro de BV individuel et récapitulatif par personne.

**Architecture :** Une nouvelle table `retributions` stocke un paiement par couple (mission, personne), écrite à la demande. Les lignes affichées sont **calculées** par un module pur (`lib/tresorerie/retributions.ts`) à partir des missions, des candidatures acceptées et des lignes de rétribution existantes. `lib/actions/tresorerie.ts` reste le seul point d'accès base + permissions ; la page `app/(dashboard)/tresorerie/page.tsx` n'affiche que le résultat.

**Tech stack :** Next.js 14 (App Router, server actions), Supabase Postgres + RLS, TypeScript, Tailwind, vitest, ExcelJS.

**Spec de référence :** [docs/superpowers/specs/2026-09-08-retributions-par-intervenant-design.md](../specs/2026-09-08-retributions-par-intervenant-design.md)

**Rappel projet :** les migrations ne s'appliquent pas automatiquement — à la fin, signaler à Felix qu'il doit exécuter `067_retributions_intervenants.sql` depuis le dashboard Supabase.

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `lib/tresorerie/retributions.ts` (créer) | Logique pure : composition des lignes, agrégats par personne, KPI, numérotation BV. Aucun accès base. |
| `lib/tresorerie/retributions.test.ts` (créer) | Tests vitest du module pur. |
| `supabase/migrations/067_retributions_intervenants.sql` (créer) | Table `retributions`, index, RLS, trigger `updated_at`, backfill des paiements existants. |
| `lib/actions/tresorerie.ts` (modifier) | Chargement des données (missions + candidatures + rétributions) et actions d'écriture, sous garde `voir_factures`. |
| `app/(dashboard)/tresorerie/page.tsx` (modifier) | Onglet « Suivi des rétributions » groupé par mission, onglet « Par intervenant », modale de paiement individuelle. |
| `app/api/tresorerie/export/route.ts` (modifier) | Feuille « Bulletins de versement » alimentée par `retributions`. |

---

### Task 1 : Module pur — numérotation des BV

**Files:**
- Create: `lib/tresorerie/retributions.ts`
- Test: `lib/tresorerie/retributions.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `lib/tresorerie/retributions.test.ts` :

```ts
import { describe, it, expect } from "vitest"
import { nextNumeroBV } from "./retributions"

describe("nextNumeroBV", () => {
  it("démarre à 001 quand aucun numéro n'existe", () => {
    expect(nextNumeroBV([], 2026)).toBe("BV-2026-001")
  })

  it("incrémente le plus grand numéro de l'année", () => {
    expect(nextNumeroBV(["BV-2026-001", "BV-2026-009", "BV-2026-004"], 2026)).toBe("BV-2026-010")
  })

  it("ignore les numéros des autres années", () => {
    expect(nextNumeroBV(["BV-2025-042"], 2026)).toBe("BV-2026-001")
  })

  it("ignore les numéros libres saisis à la main et les valeurs nulles", () => {
    expect(nextNumeroBV(["virement mars", null, undefined, "BV-2026-002"], 2026)).toBe("BV-2026-003")
  })

  it("passe à 4 chiffres au-delà de 999 sans tronquer", () => {
    expect(nextNumeroBV(["BV-2026-999"], 2026)).toBe("BV-2026-1000")
  })
})
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run lib/tresorerie/retributions.test.ts`
Expected: FAIL — `Failed to resolve import "./retributions"`.

- [ ] **Step 3 : Écrire l'implémentation minimale**

Créer `lib/tresorerie/retributions.ts` :

```ts
/**
 * Rétributions intervenants — logique pure (aucun accès base).
 *
 * Une « rétribution » est le versement dû à UNE personne pour UNE mission.
 * La table `retributions` ne stocke que les lignes déjà traitées (BV émis ou
 * paiement enregistré) : les lignes affichées sont recomposées ici à partir des
 * missions, des intervenants sélectionnés et des lignes déjà écrites.
 */

/** Arrondi au centime, pour ne pas traîner de flottants dans les totaux. */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Prochain numéro de BV libre pour l'année : `BV-<année>-<séquence>`.
 * Les numéros hors format (saisis à la main) sont ignorés, jamais écrasés.
 */
export function nextNumeroBV(
  numerosExistants: (string | null | undefined)[],
  annee: number
): string {
  const re = /^BV-(\d{4})-(\d+)$/
  let max = 0
  for (const numero of numerosExistants) {
    const match = re.exec((numero ?? "").trim())
    if (!match) continue
    if (Number(match[1]) !== annee) continue
    max = Math.max(max, Number(match[2]))
  }
  return `BV-${annee}-${String(max + 1).padStart(3, "0")}`
}
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run lib/tresorerie/retributions.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5 : Commit**

```bash
git add lib/tresorerie/retributions.ts lib/tresorerie/retributions.test.ts
git commit -m "feat(tresorerie): numérotation automatique des bulletins de versement"
```

---

### Task 2 : Module pur — composition des lignes de rétribution

**Files:**
- Modify: `lib/tresorerie/retributions.ts`
- Test: `lib/tresorerie/retributions.test.ts`

- [ ] **Step 1 : Écrire les tests qui échouent**

Ajouter en haut de `lib/tresorerie/retributions.test.ts` (compléter l'import existant) :

```ts
import { describe, it, expect } from "vitest"
import {
  buildRetributionRows,
  nextNumeroBV,
  type MissionSource,
  type IntervenantSource,
  type RetributionRecord,
} from "./retributions"

const mission = (over: Partial<MissionSource> = {}): MissionSource => ({
  id: "m1",
  nom: "Création de contenus",
  etude_id: "e1",
  etude_numero: "2620",
  etude_nom: "Étude contenus",
  date_debut: "2026-10-05",
  date_fin: "2026-11-29",
  remuneration: 100,
  nb_jeh: 2,
  nb_intervenants: 3,
  date_paiement: null,
  numero_bv: null,
  ...over,
})

const inter = (personne_id: string, nom: string, mission_id = "m1"): IntervenantSource => ({
  mission_id,
  personne_id,
  nom,
})

const record = (over: Partial<RetributionRecord> = {}): RetributionRecord => ({
  mission_id: "m1",
  personne_id: "p1",
  personne_nom: "Alice Martin",
  numero_bv: "BV-2026-001",
  date_paiement: "2026-12-01",
  montant: 200,
  ...over,
})
```

Puis ajouter le bloc de tests :

```ts
describe("buildRetributionRows", () => {
  it("crée une ligne par intervenant sélectionné, au montant unitaire remuneration × nb_jeh", () => {
    const rows = buildRetributionRows(
      [mission({ nb_intervenants: 2 })],
      [inter("p1", "Alice Martin"), inter("p2", "Bob Durand")],
      []
    )
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.intervenant_nom)).toEqual(["Alice Martin", "Bob Durand"])
    expect(rows.every((r) => r.montant === 200)).toBe(true)
    expect(rows.every((r) => r.paye === false)).toBe(true)
  })

  it("marque payée la seule ligne qui a une rétribution enregistrée", () => {
    const rows = buildRetributionRows(
      [mission({ nb_intervenants: 2 })],
      [inter("p1", "Alice Martin"), inter("p2", "Bob Durand")],
      [record({ personne_id: "p1" })]
    )
    const alice = rows.find((r) => r.personne_id === "p1")!
    const bob = rows.find((r) => r.personne_id === "p2")!
    expect(alice.paye).toBe(true)
    expect(alice.numero_bv).toBe("BV-2026-001")
    expect(bob.paye).toBe(false)
    expect(bob.numero_bv).toBeNull()
  })

  it("fige le montant enregistré même si le barème de la mission a changé depuis", () => {
    const rows = buildRetributionRows(
      [mission({ nb_intervenants: 1, remuneration: 500 })],
      [inter("p1", "Alice Martin")],
      [record({ montant: 200 })]
    )
    expect(rows[0].montant).toBe(200)
  })

  it("ajoute une ligne d'alerte pour les intervenants déclarés mais non sélectionnés", () => {
    const rows = buildRetributionRows(
      [mission({ nb_intervenants: 3 })],
      [inter("p1", "Alice Martin")],
      []
    )
    const alerte = rows.find((r) => r.personne_id === null)!
    expect(alerte.manquants).toBe(2)
    expect(alerte.montant).toBe(400)
  })

  it("affiche une mission sans aucun intervenant comme une seule ligne d'alerte au montant total", () => {
    const rows = buildRetributionRows([mission({ nb_intervenants: 3 })], [], [])
    expect(rows).toHaveLength(1)
    expect(rows[0].personne_id).toBeNull()
    expect(rows[0].manquants).toBe(3)
    expect(rows[0].montant).toBe(600)
  })

  it("hérite du paiement enregistré au niveau mission quand elle n'a qu'un intervenant", () => {
    const rows = buildRetributionRows(
      [mission({ nb_intervenants: 1, date_paiement: "2026-05-02", numero_bv: "BV-2026-007" })],
      [inter("p1", "Alice Martin")],
      []
    )
    expect(rows[0].paye).toBe(true)
    expect(rows[0].date_paiement).toBe("2026-05-02")
    expect(rows[0].numero_bv).toBe("BV-2026-007")
  })

  it("conserve une ligne payée pour une personne retirée de la mission, signalée orpheline", () => {
    const rows = buildRetributionRows(
      [mission({ nb_intervenants: 1 })],
      [inter("p2", "Bob Durand")],
      [record({ personne_id: "p1", personne_nom: "Alice Martin" })]
    )
    const orpheline = rows.find((r) => r.personne_id === "p1")!
    expect(orpheline.orphelin).toBe(true)
    expect(orpheline.intervenant_nom).toBe("Alice Martin")
    expect(rows.find((r) => r.personne_id === "p2")!.orphelin).toBe(false)
  })

  it("dédoublonne une personne présente à la fois en candidature et en intervenant direct", () => {
    const rows = buildRetributionRows(
      [mission({ nb_intervenants: 1 })],
      [inter("p1", "Alice Martin"), inter("p1", "Alice Martin")],
      []
    )
    expect(rows).toHaveLength(1)
  })

  it("porte les informations d'étude et de mission sur chaque ligne", () => {
    const rows = buildRetributionRows(
      [mission({ nb_intervenants: 1 })],
      [inter("p1", "Alice Martin")],
      []
    )
    expect(rows[0]).toMatchObject({
      mission_id: "m1",
      mission_nom: "Création de contenus",
      etude_id: "e1",
      etude_numero: "2620",
      date_debut: "2026-10-05",
      date_fin: "2026-11-29",
    })
  })
})
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run lib/tresorerie/retributions.test.ts`
Expected: FAIL — `buildRetributionRows is not a function` (les 5 tests de `nextNumeroBV` restent au vert).

- [ ] **Step 3 : Écrire l'implémentation**

Ajouter dans `lib/tresorerie/retributions.ts`, après `round2` et avant `nextNumeroBV` :

```ts
/** Mission telle que chargée depuis la base pour le calcul des rétributions. */
export type MissionSource = {
  id: string
  nom: string
  etude_id: string | null
  etude_numero: string | null
  etude_nom: string | null
  date_debut: string | null
  date_fin: string | null
  remuneration: number
  nb_jeh: number
  nb_intervenants: number
  /** Paiement historique saisi au niveau mission (avant la table retributions). */
  date_paiement: string | null
  numero_bv: string | null
}

/** Personne intervenante sur une mission (candidature acceptée ou assignation directe). */
export type IntervenantSource = {
  mission_id: string
  personne_id: string
  nom: string
}

/** Ligne déjà écrite dans la table `retributions`. */
export type RetributionRecord = {
  mission_id: string
  personne_id: string
  personne_nom: string | null
  numero_bv: string | null
  date_paiement: string | null
  montant: number
}

/** Ligne affichée dans le tableau de suivi. */
export type RetributionRow = {
  /** Identifiant stable pour React : `<mission>:<personne>` ou `<mission>:_reste`. */
  key: string
  mission_id: string
  mission_nom: string
  etude_id: string | null
  etude_numero: string | null
  etude_nom: string | null
  date_debut: string | null
  date_fin: string | null
  /** null = ligne d'alerte « intervenants non sélectionnés ». */
  personne_id: string | null
  intervenant_nom: string | null
  numero_bv: string | null
  date_paiement: string | null
  paye: boolean
  montant: number
  /** Payée alors que la personne n'est plus intervenante sur la mission. */
  orphelin: boolean
  /** Nombre d'intervenants déclarés mais non sélectionnés (ligne d'alerte only). */
  manquants: number
}

/** Montant dû à UN intervenant : remuneration × nb_jeh. */
export function montantParIntervenant(m: MissionSource): number {
  return round2(Number(m.remuneration ?? 0) * Number(m.nb_jeh ?? 0))
}

/** Nombre d'intervenants déclarés sur la mission (au moins 1). */
function effectifDeclare(m: MissionSource): number {
  return Math.max(Number(m.nb_intervenants ?? 1) || 1, 1)
}

/**
 * Recompose les lignes affichables : une par intervenant sélectionné, plus une
 * ligne d'alerte pour les intervenants déclarés mais jamais sélectionnés (afin
 * que la rétribution due ne disparaisse ni du tableau ni des KPI).
 */
export function buildRetributionRows(
  missions: MissionSource[],
  intervenants: IntervenantSource[],
  records: RetributionRecord[]
): RetributionRow[] {
  const intervenantsParMission = new Map<string, IntervenantSource[]>()
  for (const i of intervenants) {
    const liste = intervenantsParMission.get(i.mission_id) ?? []
    if (!liste.some((x) => x.personne_id === i.personne_id)) liste.push(i)
    intervenantsParMission.set(i.mission_id, liste)
  }

  const recordsParMission = new Map<string, RetributionRecord[]>()
  for (const r of records) {
    const liste = recordsParMission.get(r.mission_id) ?? []
    liste.push(r)
    recordsParMission.set(r.mission_id, liste)
  }

  const rows: RetributionRow[] = []

  for (const m of missions) {
    const liste = intervenantsParMission.get(m.id) ?? []
    const recs = recordsParMission.get(m.id) ?? []
    const recParPersonne = new Map(recs.map((r) => [r.personne_id, r]))
    const unitaire = montantParIntervenant(m)

    const commun = {
      mission_id: m.id,
      mission_nom: m.nom,
      etude_id: m.etude_id,
      etude_numero: m.etude_numero,
      etude_nom: m.etude_nom,
      date_debut: m.date_debut,
      date_fin: m.date_fin,
    }

    for (const i of liste) {
      const rec = recParPersonne.get(i.personne_id)
      // Mission mono-intervenant payée avant la migration : le paiement vit
      // encore sur la ligne mission, on le rattache à son unique intervenant.
      const herite = !rec && liste.length === 1
      const date_paiement = rec ? rec.date_paiement : herite ? m.date_paiement : null
      const numero_bv = rec ? rec.numero_bv : herite ? m.numero_bv : null
      rows.push({
        ...commun,
        key: `${m.id}:${i.personne_id}`,
        personne_id: i.personne_id,
        intervenant_nom: i.nom,
        numero_bv,
        date_paiement,
        paye: !!date_paiement,
        montant: rec ? round2(rec.montant) : unitaire,
        orphelin: false,
        manquants: 0,
      })
    }

    for (const r of recs) {
      if (liste.some((i) => i.personne_id === r.personne_id)) continue
      rows.push({
        ...commun,
        key: `${m.id}:${r.personne_id}`,
        personne_id: r.personne_id,
        intervenant_nom: r.personne_nom,
        numero_bv: r.numero_bv,
        date_paiement: r.date_paiement,
        paye: !!r.date_paiement,
        montant: round2(r.montant),
        orphelin: true,
        manquants: 0,
      })
    }

    const manquants = Math.max(effectifDeclare(m) - liste.length, 0)
    if (manquants > 0) {
      // Le paiement mission n'est repris ici que si personne n'est sélectionné,
      // sinon il a déjà été rattaché à l'intervenant unique ci-dessus.
      const orphelinDePaiement = liste.length === 0
      rows.push({
        ...commun,
        key: `${m.id}:_reste`,
        personne_id: null,
        intervenant_nom: null,
        numero_bv: orphelinDePaiement ? m.numero_bv : null,
        date_paiement: orphelinDePaiement ? m.date_paiement : null,
        paye: orphelinDePaiement ? !!m.date_paiement : false,
        montant: round2(unitaire * manquants),
        orphelin: false,
        manquants,
      })
    }
  }

  return rows
}
```

- [ ] **Step 4 : Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run lib/tresorerie/retributions.test.ts`
Expected: PASS — 14 tests.

- [ ] **Step 5 : Commit**

```bash
git add lib/tresorerie/retributions.ts lib/tresorerie/retributions.test.ts
git commit -m "feat(tresorerie): composition des lignes de rétribution par intervenant"
```

---

### Task 3 : Module pur — agrégats par personne et KPI

**Files:**
- Modify: `lib/tresorerie/retributions.ts`
- Test: `lib/tresorerie/retributions.test.ts`

- [ ] **Step 1 : Écrire les tests qui échouent**

Compléter l'import du fichier de test avec `agregerParPersonne`, `kpisRetributions` et le type `RetributionParPersonne`, puis ajouter :

```ts
describe("agregerParPersonne", () => {
  const rows = buildRetributionRows(
    [
      mission({ id: "m1", nb_intervenants: 2 }),
      mission({ id: "m2", nom: "Focus group", nb_intervenants: 1, remuneration: 300, nb_jeh: 1 }),
    ],
    [
      inter("p1", "Alice Martin", "m1"),
      inter("p2", "Bob Durand", "m1"),
      inter("p1", "Alice Martin", "m2"),
    ],
    [record({ mission_id: "m1", personne_id: "p1" })]
  )

  it("totalise le dû et le versé par personne", () => {
    const agg = agregerParPersonne(rows)
    const alice = agg.find((a) => a.personne_id === "p1")!
    expect(alice.totalVerse).toBe(200)
    expect(alice.totalDu).toBe(300)
    expect(alice.nbMissions).toBe(2)
    expect(alice.nbBv).toBe(1)
  })

  it("ignore les lignes d'alerte sans personne", () => {
    const agg = agregerParPersonne(buildRetributionRows([mission({ nb_intervenants: 3 })], [], []))
    expect(agg).toHaveLength(0)
  })

  it("trie par montant dû décroissant", () => {
    const agg = agregerParPersonne(rows)
    expect(agg.map((a) => a.personne_id)).toEqual(["p1", "p2"])
  })
})

describe("kpisRetributions", () => {
  it("sépare le dû, le versé et le nombre de rétributions à payer", () => {
    const rows = buildRetributionRows(
      [mission({ nb_intervenants: 3 })],
      [inter("p1", "Alice Martin"), inter("p2", "Bob Durand")],
      [record({ personne_id: "p1" })]
    )
    // Alice payée 200 ; Bob dû 200 ; ligne d'alerte 1 × 200 dû.
    const kpis = kpisRetributions(rows)
    expect(kpis.totalRetributionVersee).toBe(200)
    expect(kpis.totalRetributionDue).toBe(400)
    expect(kpis.nbRetributionsAPayer).toBe(2)
  })
})
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run lib/tresorerie/retributions.test.ts`
Expected: FAIL — `agregerParPersonne is not a function`.

- [ ] **Step 3 : Écrire l'implémentation**

Ajouter à la fin de `lib/tresorerie/retributions.ts` :

```ts
/** Récapitulatif de rétribution pour une personne, toutes missions confondues. */
export type RetributionParPersonne = {
  personne_id: string
  intervenant_nom: string
  nbMissions: number
  nbBv: number
  totalDu: number
  totalVerse: number
}

/** Agrège les lignes par personne, triées par montant dû décroissant. */
export function agregerParPersonne(rows: RetributionRow[]): RetributionParPersonne[] {
  const parPersonne = new Map<string, RetributionParPersonne>()
  for (const row of rows) {
    if (!row.personne_id) continue
    let agg = parPersonne.get(row.personne_id)
    if (!agg) {
      agg = {
        personne_id: row.personne_id,
        intervenant_nom: row.intervenant_nom ?? "—",
        nbMissions: 0,
        nbBv: 0,
        totalDu: 0,
        totalVerse: 0,
      }
      parPersonne.set(row.personne_id, agg)
    }
    agg.nbMissions += 1
    if (row.numero_bv) agg.nbBv += 1
    if (row.paye) agg.totalVerse = round2(agg.totalVerse + row.montant)
    else agg.totalDu = round2(agg.totalDu + row.montant)
  }
  return Array.from(parPersonne.values()).sort(
    (a, b) => b.totalDu - a.totalDu || a.intervenant_nom.localeCompare(b.intervenant_nom, "fr")
  )
}

/** KPI de l'en-tête trésorerie, calculés sur les lignes de rétribution. */
export function kpisRetributions(rows: RetributionRow[]) {
  let totalRetributionDue = 0
  let totalRetributionVersee = 0
  let nbRetributionsAPayer = 0
  for (const row of rows) {
    if (row.paye) {
      totalRetributionVersee = round2(totalRetributionVersee + row.montant)
    } else {
      totalRetributionDue = round2(totalRetributionDue + row.montant)
      nbRetributionsAPayer += 1
    }
  }
  return { totalRetributionDue, totalRetributionVersee, nbRetributionsAPayer }
}
```

- [ ] **Step 4 : Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run lib/tresorerie/retributions.test.ts`
Expected: PASS — 18 tests.

- [ ] **Step 5 : Commit**

```bash
git add lib/tresorerie/retributions.ts lib/tresorerie/retributions.test.ts
git commit -m "feat(tresorerie): agrégats de rétribution par personne et KPI"
```

---

### Task 4 : Migration SQL

**Files:**
- Create: `supabase/migrations/067_retributions_intervenants.sql`

- [ ] **Step 1 : Écrire la migration**

Créer `supabase/migrations/067_retributions_intervenants.sql` :

```sql
-- 067_retributions_intervenants.sql
--
-- Suivi du versement des rétributions INTERVENANT PAR INTERVENANT.
-- Jusqu'ici le paiement vivait sur `missions` (date_paiement / numero_bv) :
-- une mission portée par 26 intervenants n'avait qu'un seul statut de paiement,
-- impossible de savoir qui avait été payé.
--
-- La table ne contient que les lignes déjà traitées (BV émis ou paiement
-- enregistré) : la liste des intervenants d'une mission reste dérivée des
-- candidatures acceptées + missions.intervenant_id.
--
-- Les colonnes missions.date_paiement / numero_bv sont CONSERVÉES : elles
-- restent le seul moyen de tracer une mission sans intervenant sélectionné.

CREATE TABLE IF NOT EXISTS public.retributions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id    UUID NOT NULL REFERENCES public.missions(id)  ON DELETE CASCADE,
  personne_id   UUID NOT NULL REFERENCES public.personnes(id) ON DELETE CASCADE,
  numero_bv     TEXT,
  date_paiement DATE,
  montant       NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes         TEXT,
  created_by    UUID REFERENCES public.personnes(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT retributions_mission_personne_unique UNIQUE (mission_id, personne_id)
);

CREATE INDEX IF NOT EXISTS retributions_mission_id_idx    ON public.retributions(mission_id);
CREATE INDEX IF NOT EXISTS retributions_personne_id_idx   ON public.retributions(personne_id);
CREATE INDEX IF NOT EXISTS retributions_date_paiement_idx ON public.retributions(date_paiement);
-- Index NON unique : des paiements historiques peuvent partager un numéro.
-- L'unicité est vérifiée par la server action, avec un message explicite.
CREATE INDEX IF NOT EXISTS retributions_numero_bv_idx     ON public.retributions(numero_bv);

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Lecture : membres internes. Écriture : porteurs de `voir_factures`
-- (Présidente, Trésorier·ère, Pôle Trésorerie, admins) — même règle que la
-- garde applicative requireVoirFactures.
ALTER TABLE public.retributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "retributions read"   ON public.retributions;
DROP POLICY IF EXISTS "retributions write"  ON public.retributions;
DROP POLICY IF EXISTS "retributions delete" ON public.retributions;

CREATE POLICY "retributions read" ON public.retributions FOR SELECT TO authenticated
  USING (public.is_membre_interne(auth.uid()));

CREATE POLICY "retributions write" ON public.retributions FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'voir_factures'))
  WITH CHECK (public.has_permission(auth.uid(), 'voir_factures'));

-- ── updated_at ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_retributions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS retributions_updated_at_trigger ON public.retributions;
CREATE TRIGGER retributions_updated_at_trigger
  BEFORE UPDATE ON public.retributions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_retributions_updated_at();

-- ── Reprise de l'historique ────────────────────────────────────────────────
-- Chaque mission déjà payée et dotée d'un intervenant identifié devient une
-- ligne de rétribution, pour ne pas perdre les paiements saisis. Rejouable.
INSERT INTO public.retributions (mission_id, personne_id, numero_bv, date_paiement, montant)
SELECT
  m.id,
  m.intervenant_id,
  m.numero_bv,
  m.date_paiement,
  ROUND(COALESCE(m.remuneration, 0) * COALESCE(m.nb_jeh, 0), 2)
FROM public.missions m
WHERE m.intervenant_id IS NOT NULL
  AND (m.date_paiement IS NOT NULL OR m.numero_bv IS NOT NULL)
ON CONFLICT ON CONSTRAINT retributions_mission_personne_unique DO NOTHING;

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2 : Vérifier la cohérence des helpers utilisés**

Run: `grep -rn "FUNCTION public.is_membre_interne\|FUNCTION public.has_permission" supabase/migrations/*.sql`
Expected: `is_membre_interne` (migration 050) et `has_permission` (migration 055) existent bien — la migration 067 peut les appeler.

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/067_retributions_intervenants.sql
git commit -m "feat(tresorerie): migration table retributions (paiement par intervenant)"
```

⚠️ Ne pas oublier en fin de plan : cette migration doit être appliquée **manuellement** par Felix.

---

### Task 5 : Chargement des données côté serveur

**Files:**
- Modify: `lib/actions/tresorerie.ts` (types + `getTresorerieData`, lignes 40-54 et 84-284)

- [ ] **Step 1 : Remplacer le type `MissionPayRow` par le nouveau contrat**

Dans `lib/actions/tresorerie.ts`, remplacer le bloc `export type MissionPayRow = { … }` (lignes 40-54) par :

```ts
export type {
  RetributionRow,
  RetributionParPersonne,
} from "@/lib/tresorerie/retributions"
```

et ajouter en tête de fichier, après les imports existants :

```ts
import {
  buildRetributionRows,
  agregerParPersonne,
  kpisRetributions,
  nextNumeroBV,
  montantParIntervenant,
  type MissionSource,
  type IntervenantSource,
  type RetributionRecord,
} from "@/lib/tresorerie/retributions"
```

- [ ] **Step 2 : Charger candidatures et rétributions dans `getTresorerieData`**

Dans `getTresorerieData`, remplacer le bloc « Fetch intervenants (personnes) … » (lignes 150-164) et la construction `const missions: MissionPayRow[] = …` (lignes 186-208) par :

```ts
  // Intervenants d'une mission = candidatures acceptées + intervenant assigné
  // directement (missions de suivi d'étude). Même règle que
  // listMissionIntervenants dans lib/actions/documents.ts.
  const missionIds = (missionsRes.data ?? []).map((m: any) => m.id)

  const [candidaturesRes, retributionsRes] = await Promise.all([
    missionIds.length
      ? supabase
          .from("candidatures")
          .select("mission_id, personne_id, personnes!candidatures_personne_id_fkey(id, prenom, nom)")
          .eq("statut", "acceptee")
          .in("mission_id", missionIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    missionIds.length
      ? supabase
          .from("retributions")
          .select("mission_id, personne_id, numero_bv, date_paiement, montant, personnes(id, prenom, nom)")
          .in("mission_id", missionIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ])

  // Table absente (migration 067 pas encore appliquée) : on continue en mode
  // dégradé — les lignes s'affichent, seul l'enregistrement des paiements
  // individuels est indisponible.
  let retributionsData: any[] = []
  if (retributionsRes.error) {
    if ((retributionsRes.error as any).code === "42P01") {
      migrationMissing = true
    } else {
      return { error: retributionsRes.error.message }
    }
  } else {
    retributionsData = retributionsRes.data ?? []
  }
  if (candidaturesRes.error) return { error: candidaturesRes.error.message }

  // Personnes assignées directement (hors candidatures) : un seul aller-retour.
  const intervenantIds = Array.from(
    new Set((missionsRes.data ?? []).map((m: any) => m.intervenant_id).filter(Boolean))
  ) as string[]
  const personnesById = new Map<string, { id: string; prenom: string | null; nom: string | null }>()
  if (intervenantIds.length > 0) {
    const personnesRes = await supabase
      .from("personnes")
      .select("id, prenom, nom")
      .in("id", intervenantIds)
    for (const p of personnesRes.data ?? []) personnesById.set(p.id, p)
  }

  const nomComplet = (p: { prenom?: string | null; nom?: string | null } | null | undefined) =>
    p ? [p.prenom, p.nom].filter(Boolean).join(" ").trim() || null : null

  const missionSources: MissionSource[] = (missionsRes.data ?? []).map((m: any) => ({
    id: m.id,
    nom: m.nom,
    etude_id: m.etude_id,
    etude_numero: m.etudes?.numero ?? null,
    etude_nom: m.etudes?.nom ?? null,
    date_debut: m.date_debut,
    date_fin: m.date_fin,
    remuneration: Number(m.remuneration ?? 0),
    nb_jeh: Number(m.nb_jeh ?? 0),
    nb_intervenants: Number(m.nb_intervenants ?? 1),
    date_paiement: m.date_paiement ?? null,
    numero_bv: m.numero_bv ?? null,
  }))

  const intervenantSources: IntervenantSource[] = [
    ...(candidaturesRes.data ?? []).map((c: any) => ({
      mission_id: c.mission_id,
      personne_id: c.personne_id,
      nom: nomComplet(c.personnes) ?? "Intervenant·e",
    })),
    ...(missionsRes.data ?? [])
      .filter((m: any) => m.intervenant_id)
      .map((m: any) => ({
        mission_id: m.id,
        personne_id: m.intervenant_id,
        nom: nomComplet(personnesById.get(m.intervenant_id)) ?? "Intervenant·e",
      })),
  ]

  const retributionRecords: RetributionRecord[] = retributionsData.map((r: any) => ({
    mission_id: r.mission_id,
    personne_id: r.personne_id,
    personne_nom: nomComplet(r.personnes),
    numero_bv: r.numero_bv ?? null,
    date_paiement: r.date_paiement ?? null,
    montant: Number(r.montant ?? 0),
  }))

  const retributions = buildRetributionRows(missionSources, intervenantSources, retributionRecords)
  const retributionsParPersonne = agregerParPersonne(retributions)
```

- [ ] **Step 3 : Brancher les KPI et la valeur de retour**

Remplacer les deux lignes de KPI rétribution (lignes 248-249) par :

```ts
  const { totalRetributionDue, totalRetributionVersee, nbRetributionsAPayer } =
    kpisRetributions(retributions)
```

Puis, dans l'objet retourné, remplacer `missions,` par `retributions,` et `retributionsParPersonne,`, et dans `kpis` remplacer la ligne `nbMissionsAPayer: missions.filter((m) => !m.paye).length` par `nbRetributionsAPayer`.

- [ ] **Step 4 : Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: les seules erreurs restantes concernent `app/(dashboard)/tresorerie/page.tsx` (qui référence encore `MissionPayRow` / `data.missions`) — elles seront corrigées en Task 7. Aucune erreur dans `lib/`.

- [ ] **Step 5 : Commit**

```bash
git add lib/actions/tresorerie.ts
git commit -m "feat(tresorerie): charger les rétributions par intervenant"
```

---

### Task 6 : Actions d'écriture des paiements

**Files:**
- Modify: `lib/actions/tresorerie.ts` (après `marquerMissionPaiement`, fin de fichier)

- [ ] **Step 1 : Ajouter les actions**

Ajouter à la fin de `lib/actions/tresorerie.ts` (garder `marquerMissionPaiement` telle quelle : elle sert aux missions sans intervenant sélectionné) :

```ts
/**
 * Numéro de BV proposé par défaut : suite de l'année en cours, en tenant compte
 * des numéros déjà utilisés côté rétributions ET côté missions (historique).
 */
export async function getProchainNumeroBV() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }
  const permErr = await requireVoirFactures(user.id)
  if (permErr) return { error: permErr }

  const [retRes, misRes] = await Promise.all([
    supabase.from("retributions").select("numero_bv").not("numero_bv", "is", null),
    supabase.from("missions").select("numero_bv").not("numero_bv", "is", null),
  ])
  const numeros = [
    ...(retRes.data ?? []).map((r: any) => r.numero_bv),
    ...(misRes.data ?? []).map((m: any) => m.numero_bv),
  ]
  return { data: nextNumeroBV(numeros, new Date().getFullYear()) }
}

/** Vérifie qu'un numéro de BV n'est pas déjà porté par une autre rétribution. */
async function numeroBVLibre(
  supabase: ReturnType<typeof createClient>,
  numero: string,
  missionId: string,
  personneId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("retributions")
    .select("mission_id, personne_id")
    .eq("numero_bv", numero)
  return !(data ?? []).some(
    (r: any) => r.mission_id !== missionId || r.personne_id !== personneId
  )
}

/**
 * Enregistre (ou met à jour) le versement dû à UNE personne pour UNE mission.
 * Le montant est figé à l'écriture : le suivi comptable ne bouge plus si le
 * barème de la mission change ensuite.
 */
export async function marquerRetributionPaiement(input: {
  mission_id: string
  personne_id: string
  date_paiement: string | null
  numero_bv?: string | null
  montant: number
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }
  const permErr = await requireVoirFactures(user.id)
  if (permErr) return { error: permErr }

  const numero = input.numero_bv?.trim() || null
  if (numero && !(await numeroBVLibre(supabase, numero, input.mission_id, input.personne_id))) {
    return { error: `Le numéro ${numero} est déjà utilisé par un autre bulletin.` }
  }

  const { error } = await supabase.from("retributions").upsert(
    {
      mission_id: input.mission_id,
      personne_id: input.personne_id,
      date_paiement: input.date_paiement,
      numero_bv: numero,
      montant: input.montant,
      created_by: user.id,
    },
    { onConflict: "mission_id,personne_id" }
  )
  if (error) {
    if (error.code === "42P01") {
      return { error: "Migration 067 non appliquée : le suivi par intervenant n'est pas encore actif." }
    }
    return { error: error.message }
  }

  revalidateTag(MISSIONS_TAG)
  revalidatePath("/tresorerie")
  return { success: true }
}

/** Annule le versement d'une rétribution ; le numéro de BV émis est conservé. */
export async function annulerRetributionPaiement(missionId: string, personneId: string) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }
  const permErr = await requireVoirFactures(user.id)
  if (permErr) return { error: permErr }

  const { error } = await supabase
    .from("retributions")
    .update({ date_paiement: null })
    .eq("mission_id", missionId)
    .eq("personne_id", personneId)
  if (error) return { error: error.message }

  revalidateTag(MISSIONS_TAG)
  revalidatePath("/tresorerie")
  return { success: true }
}

/**
 * Marque payés tous les intervenants encore dus d'une mission, un numéro de BV
 * attribué à chacun.
 */
export async function marquerMissionRetributionsPayees(
  missionId: string,
  date_paiement: string
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }
  const permErr = await requireVoirFactures(user.id)
  if (permErr) return { error: permErr }

  const [missionRes, candidaturesRes, retributionsRes, numerosRes] = await Promise.all([
    supabase
      .from("missions")
      .select("id, remuneration, nb_jeh, intervenant_id")
      .eq("id", missionId)
      .single(),
    supabase
      .from("candidatures")
      .select("personne_id")
      .eq("mission_id", missionId)
      .eq("statut", "acceptee"),
    supabase
      .from("retributions")
      .select("personne_id, date_paiement, numero_bv")
      .eq("mission_id", missionId),
    supabase.from("retributions").select("numero_bv").not("numero_bv", "is", null),
  ])
  if (missionRes.error) return { error: missionRes.error.message }
  if (retributionsRes.error) {
    if ((retributionsRes.error as any).code === "42P01") {
      return { error: "Migration 067 non appliquée : le suivi par intervenant n'est pas encore actif." }
    }
    return { error: retributionsRes.error.message }
  }

  const mission = missionRes.data as any
  const dejaPaye = new Set(
    (retributionsRes.data ?? []).filter((r: any) => r.date_paiement).map((r: any) => r.personne_id)
  )
  const personneIds = Array.from(
    new Set([
      ...(candidaturesRes.data ?? []).map((c: any) => c.personne_id),
      ...(mission.intervenant_id ? [mission.intervenant_id] : []),
    ])
  ).filter((id) => !dejaPaye.has(id))

  if (personneIds.length === 0) return { success: true }

  const montant = montantParIntervenant({
    id: mission.id,
    nom: "",
    etude_id: null,
    etude_numero: null,
    etude_nom: null,
    date_debut: null,
    date_fin: null,
    remuneration: Number(mission.remuneration ?? 0),
    nb_jeh: Number(mission.nb_jeh ?? 0),
    nb_intervenants: 1,
    date_paiement: null,
    numero_bv: null,
  })

  const numerosUtilises = (numerosRes.data ?? []).map((r: any) => r.numero_bv)
  const annee = new Date().getFullYear()
  const lignes = personneIds.map((personne_id) => {
    const numero = nextNumeroBV(numerosUtilises, annee)
    numerosUtilises.push(numero)
    return {
      mission_id: missionId,
      personne_id,
      date_paiement,
      numero_bv: numero,
      montant,
      created_by: user.id,
    }
  })

  const { error } = await supabase
    .from("retributions")
    .upsert(lignes, { onConflict: "mission_id,personne_id" })
  if (error) return { error: error.message }

  revalidateTag(MISSIONS_TAG)
  revalidatePath("/tresorerie")
  return { success: true }
}
```

- [ ] **Step 2 : Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: pas de nouvelle erreur dans `lib/actions/tresorerie.ts` (les erreurs de la page trésorerie restent, corrigées en Task 7).

- [ ] **Step 3 : Commit**

```bash
git add lib/actions/tresorerie.ts
git commit -m "feat(tresorerie): actions de paiement des rétributions par intervenant"
```

---

### Task 7 : Onglet « Suivi des rétributions »

**Files:**
- Modify: `app/(dashboard)/tresorerie/page.tsx` (imports l.6-17, type `Tab` l.26, état l.54-72, `missionsFiltrees` l.172-185, onglets l.388-405, tableau l.616-733, modale l.1330-1407, KPI l.377-385)

- [ ] **Step 1 : Mettre à jour imports, type d'onglet et état**

Remplacer l'import depuis `@/lib/actions/tresorerie` (lignes 6-17) par :

```tsx
import {
  getTresorerieData,
  getEtudesForFactureSelect,
  createFacture,
  updateFacture,
  deleteFacture,
  marquerFacturePaiement,
  marquerMissionPaiement,
  marquerRetributionPaiement,
  annulerRetributionPaiement,
  marquerMissionRetributionsPayees,
  getProchainNumeroBV,
  type FactureRow,
  type RetributionRow,
  type RetributionParPersonne,
  type CaParEtude,
} from "@/lib/actions/tresorerie"
```

Remplacer le type `Tab` (ligne 26) par :

```tsx
type Tab = "factures" | "ca" | "retributions" | "personnes" | "notes" | "validation" | "pilotage"
```

Dans l'état du composant : remplacer `missions: MissionPayRow[]` par

```tsx
    retributions: RetributionRow[]
    retributionsParPersonne: RetributionParPersonne[]
```

et remplacer `const [showPayMission, setShowPayMission] = useState<MissionPayRow | null>(null)` par :

```tsx
  const [showPayRetribution, setShowPayRetribution] = useState<RetributionRow | null>(null)
  const [payingMission, setPayingMission] = useState<string | null>(null)
```

- [ ] **Step 2 : Remplacer `missionsFiltrees` par des lignes groupées par mission**

Remplacer le `useMemo` `missionsFiltrees` (lignes 172-185) par :

```tsx
  const retributionsFiltrees = useMemo(() => {
    if (!data) return []
    const q = searchMission.toLowerCase().trim()
    if (!q) return data.retributions
    return data.retributions.filter((r) => {
      return (
        r.mission_nom.toLowerCase().includes(q) ||
        (r.intervenant_nom ?? "").toLowerCase().includes(q) ||
        (r.numero_bv ?? "").toLowerCase().includes(q) ||
        (r.etude_numero ?? "").toLowerCase().includes(q) ||
        (r.etude_nom ?? "").toLowerCase().includes(q)
      )
    })
  }, [data, searchMission])

  // Regroupement par mission : l'en-tête porte l'étude, le total et l'action
  // groupée ; les lignes filles portent chaque intervenant.
  const groupesRetributions = useMemo(() => {
    const groupes: {
      mission_id: string
      mission_nom: string
      etude_id: string | null
      etude_numero: string | null
      total: number
      restant: number
      rows: RetributionRow[]
    }[] = []
    const parMission = new Map<string, (typeof groupes)[number]>()
    for (const row of retributionsFiltrees) {
      let g = parMission.get(row.mission_id)
      if (!g) {
        g = {
          mission_id: row.mission_id,
          mission_nom: row.mission_nom,
          etude_id: row.etude_id,
          etude_numero: row.etude_numero,
          total: 0,
          restant: 0,
          rows: [],
        }
        parMission.set(row.mission_id, g)
        groupes.push(g)
      }
      g.rows.push(row)
      g.total += row.montant
      if (!row.paye && row.personne_id) g.restant += row.montant
    }
    return groupes
  }, [retributionsFiltrees])
```

- [ ] **Step 3 : Mettre à jour le KPI et la barre d'onglets**

Ligne 382, remplacer le libellé et la valeur du 3ᵉ KPI secondaire :

```tsx
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Rétributions à payer</p>
            <p className="text-lg font-manrope font-black text-[#00236f] tabular-nums">{kpis.nbRetributionsAPayer}</p>
```

Dans la liste des onglets (lignes 390-405), remplacer l'entrée `missions` par :

```tsx
          { key: "retributions" as Tab, label: `Suivi des rétributions (${data.retributions.length})` },
          { key: "personnes" as Tab, label: `Par intervenant (${data.retributionsParPersonne.length})` },
```

- [ ] **Step 4 : Remplacer le tableau des missions par le tableau des rétributions**

Remplacer intégralement le bloc `{activeTab === "missions" && ( … )}` (lignes 616-733) par :

```tsx
      {/* ─── Suivi des rétributions ───────────────────────── */}
      {activeTab === "retributions" && (
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="relative p-3 border-b border-zinc-100">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="search"
              placeholder="Rechercher un intervenant, une mission, un BV, une étude…"
              value={searchMission}
              onChange={(e) => setSearchMission(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-lg bg-zinc-50 border border-zinc-100 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Intervenant</th>
                  <th className="px-4 py-3">N° BV</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Paiement</th>
                  <th className="px-4 py-3 text-right">Montant</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {groupesRetributions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-zinc-400 text-sm">
                      {searchMission ? "Aucune rétribution correspondante." : "Aucune rétribution."}
                    </td>
                  </tr>
                ) : (
                  groupesRetributions.map((g) => (
                    <Fragment key={g.mission_id}>
                      <tr className="bg-zinc-50/80">
                        <td colSpan={4} className="px-4 py-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {g.etude_id ? (
                              <Link href={`/etudes/${g.etude_id}`} className="text-[#00236f] hover:underline font-semibold">
                                {g.etude_numero ?? "—"}
                              </Link>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                            <Link href={`/missions/${g.mission_id}`} className="text-zinc-700 font-medium hover:underline">
                              {g.mission_nom}
                            </Link>
                            <span className="text-xs text-zinc-400">
                              {g.rows.filter((r) => r.personne_id).length} intervenant·e·s
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-zinc-500 tabular-nums">{fmtEUR(g.total)}</td>
                        <td className="px-4 py-2">
                          <div className="flex justify-end">
                            {g.restant > 0 && (
                              <button
                                onClick={async () => {
                                  if (!confirm(`Marquer payés tous les intervenants restants de « ${g.mission_nom} » ?`)) return
                                  setPayingMission(g.mission_id)
                                  const res = await marquerMissionRetributionsPayees(
                                    g.mission_id,
                                    new Date().toISOString().slice(0, 10)
                                  )
                                  setPayingMission(null)
                                  if ((res as any).error) { alert((res as any).error); return }
                                  reload()
                                }}
                                disabled={payingMission === g.mission_id}
                                className="px-2.5 py-1 rounded-md text-xs font-semibold text-[#00236f] bg-[#00236f]/5 border border-[#00236f]/20 hover:bg-[#00236f]/10 disabled:opacity-50 transition-colors"
                              >
                                {payingMission === g.mission_id ? "…" : "Tout marquer payé"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {g.rows.map((r) => (
                        <tr key={r.key} className="group hover:bg-zinc-50 transition-colors">
                          <td className="px-4 py-3 pl-8">
                            {r.personne_id ? (
                              <span className="text-zinc-700">
                                {r.intervenant_nom}
                                {r.orphelin && (
                                  <span className="ml-2 text-[11px] text-amber-700">n&apos;est plus sur la mission</span>
                                )}
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200">
                                {r.manquants} intervenant·e·s non sélectionné·e·s
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-zinc-600">
                            {r.numero_bv ? (
                              <span className="font-mono text-xs">{r.numero_bv}</span>
                            ) : (
                              <span className="text-xs text-zinc-400">Pas de BV émis</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-zinc-600 text-xs">
                            {r.date_debut || r.date_fin ? (
                              <>
                                du {fmtDate(r.date_debut)}
                                <br />
                                au {fmtDate(r.date_fin)}
                              </>
                            ) : (
                              <span className="text-red-500 font-medium">Dates mal renseignées</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {r.paye ? (
                              <span className="text-emerald-600 font-medium">{fmtDate(r.date_paiement)}</span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded-md bg-red-50 text-red-700 text-xs font-medium border border-red-200">
                                non payé
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-[#00236f] tabular-nums">{fmtEUR(r.montant)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {!r.paye ? (
                                <button
                                  onClick={() => setShowPayRetribution(r)}
                                  className="px-2.5 py-1 rounded-md text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                                >
                                  Marquer payé
                                </button>
                              ) : (
                                <button
                                  onClick={async () => {
                                    const cible = r.intervenant_nom ?? r.mission_nom
                                    if (!confirm(`Annuler le paiement de « ${cible} » ?`)) return
                                    const res = r.personne_id
                                      ? await annulerRetributionPaiement(r.mission_id, r.personne_id)
                                      : await marquerMissionPaiement(r.mission_id, null)
                                    if ((res as any).error) { alert((res as any).error); return }
                                    reload()
                                  }}
                                  className="px-2.5 py-1 rounded-md text-xs font-medium text-zinc-500 bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 transition-colors"
                                >
                                  Annuler paiement
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
```

Ajouter `Fragment` à l'import React de la ligne 3 :

```tsx
import { Fragment, useEffect, useMemo, useState } from "react"
```

- [ ] **Step 5 : Remplacer la modale de paiement**

Remplacer le rendu conditionnel (lignes 962-966) par :

```tsx
      {showPayRetribution && (
        <PayRetributionModal
          row={showPayRetribution}
          onClose={() => setShowPayRetribution(null)}
          onSaved={() => { setShowPayRetribution(null); reload() }}
        />
      )}
```

et remplacer le composant `PayMissionModal` (lignes 1330-1407) par :

```tsx
/* ────────────────────────────────────────────────────────── */
/*  Pay retribution modal                                      */
/* ────────────────────────────────────────────────────────── */
function PayRetributionModal({
  row,
  onClose,
  onSaved,
}: {
  row: RetributionRow
  onClose: () => void
  onSaved: () => void
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [numeroBv, setNumeroBv] = useState(row.numero_bv ?? "")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Numéro proposé automatiquement, modifiable : le trésorier garde la main.
  useEffect(() => {
    if (row.numero_bv) return
    getProchainNumeroBV().then((res) => {
      if ((res as any).data) setNumeroBv((res as any).data)
    })
  }, [row.numero_bv])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100">
          <h2 className="font-manrope font-bold text-[#00236f] text-lg">Paiement intervenant</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            setSubmitting(true)
            setError(null)
            const res = row.personne_id
              ? await marquerRetributionPaiement({
                  mission_id: row.mission_id,
                  personne_id: row.personne_id,
                  date_paiement: date,
                  numero_bv: numeroBv || null,
                  montant: row.montant,
                })
              : await marquerMissionPaiement(row.mission_id, date, numeroBv || null)
            setSubmitting(false)
            if ((res as any).error) { setError((res as any).error); return }
            onSaved()
          }}
          className="p-6 space-y-4"
        >
          <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-100 text-xs space-y-1">
            <p><span className="text-zinc-500">Mission :</span> <span className="font-medium text-zinc-800">{row.mission_nom}</span></p>
            <p>
              <span className="text-zinc-500">Intervenant :</span>{" "}
              <span className="font-medium text-zinc-800">
                {row.intervenant_nom ?? `${row.manquants} intervenant·e·s non sélectionné·e·s`}
              </span>
            </p>
            <p><span className="text-zinc-500">Montant :</span> <span className="font-bold text-[#00236f]">{fmtEUR(row.montant)}</span></p>
          </div>
          {!row.personne_id && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
              Aucun intervenant n&apos;est sélectionné sur cette mission : le paiement sera enregistré
              au niveau de la mission, sans détail par personne.
            </p>
          )}
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1">Date de paiement *</label>
            <input
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1">N° BV</label>
            <input
              value={numeroBv}
              onChange={(e) => setNumeroBv(e.target.value)}
              placeholder="Ex : BV-2026-001"
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
            />
          </div>
          {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-lg">
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmer le paiement
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 6 : Vérifier compilation et lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: aucune erreur.

- [ ] **Step 7 : Vérifier dans le navigateur**

Démarrer le serveur de dev via l'outil de preview (jamais via Bash), ouvrir `/tresorerie`, onglet « Suivi des rétributions » : les missions apparaissent regroupées, une ligne par intervenant sélectionné, une ligne d'alerte ambrée pour les intervenants non sélectionnés. Vérifier l'absence d'erreur console.

- [ ] **Step 8 : Commit**

```bash
git add "app/(dashboard)/tresorerie/page.tsx"
git commit -m "feat(tresorerie): suivi des rétributions intervenant par intervenant"
```

---

### Task 8 : Onglet « Par intervenant »

**Files:**
- Modify: `app/(dashboard)/tresorerie/page.tsx` (après le bloc `activeTab === "retributions"`)

- [ ] **Step 1 : Ajouter le tableau récapitulatif**

Insérer juste après le bloc `{activeTab === "retributions" && ( … )}` :

```tsx
      {/* ─── Rétribution par intervenant ──────────────────── */}
      {activeTab === "personnes" && (
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100">
            <h2 className="font-manrope font-bold text-[#00236f]">Rétribution par intervenant</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Total dû et total déjà versé à chaque personne, toutes missions confondues.
              Cliquer une ligne filtre le suivi des rétributions sur cette personne.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Intervenant</th>
                  <th className="px-4 py-3 text-right">Missions</th>
                  <th className="px-4 py-3 text-right">BV émis</th>
                  <th className="px-4 py-3 text-right">Reste à verser</th>
                  <th className="px-4 py-3 text-right">Déjà versé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.retributionsParPersonne.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-zinc-400 text-sm">
                      Aucun intervenant sélectionné sur les missions en cours.
                    </td>
                  </tr>
                ) : (
                  data.retributionsParPersonne.map((p) => (
                    <tr
                      key={p.personne_id}
                      onClick={() => { setSearchMission(p.intervenant_nom); setActiveTab("retributions") }}
                      className="hover:bg-zinc-50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 text-zinc-700 font-medium">{p.intervenant_nom}</td>
                      <td className="px-4 py-3 text-right text-zinc-600 tabular-nums">{p.nbMissions}</td>
                      <td className="px-4 py-3 text-right text-zinc-600 tabular-nums">{p.nbBv}</td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600 tabular-nums">{fmtEUR(p.totalDu)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600 tabular-nums">{fmtEUR(p.totalVerse)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
```

- [ ] **Step 2 : Vérifier compilation et lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: aucune erreur.

- [ ] **Step 3 : Vérifier dans le navigateur**

Ouvrir `/tresorerie`, onglet « Par intervenant » : une ligne par personne, triée par reste à verser décroissant. Cliquer une ligne renvoie sur l'onglet rétributions filtré sur son nom.

- [ ] **Step 4 : Commit**

```bash
git add "app/(dashboard)/tresorerie/page.tsx"
git commit -m "feat(tresorerie): récapitulatif de rétribution par intervenant"
```

---

### Task 9 : Export comptable — feuille « Bulletins de versement »

**Files:**
- Modify: `app/api/tresorerie/export/route.ts` (lignes 54-63 et 98-110, en-têtes XLSX lignes 150-158)

- [ ] **Step 1 : Lire les BV depuis `retributions`**

Remplacer le bloc « Bulletins de versement (missions payées) » (lignes 54-63) par :

```ts
  // ── Bulletins de versement (une ligne par intervenant payé) ────────────
  // Source : table `retributions` (migration 067). Repli sur les paiements
  // encore stockés au niveau mission (missions sans intervenant identifié).
  let rq = sb
    .from("retributions")
    .select("numero_bv, montant, date_paiement, personne_id, missions(id, nom, etude_id, nb_jeh)")
    .not("date_paiement", "is", null)
    .order("date_paiement", { ascending: true })
  if (from) rq = rq.gte("date_paiement", from)
  if (to) rq = rq.lte("date_paiement", to)
  const { data: retributionRows, error: rErr } = await rq
  if (rErr && (rErr as any).code !== "42P01") {
    return NextResponse.json({ error: rErr.message }, { status: 500 })
  }

  let mq = sb
    .from("missions")
    .select("id, nom, numero_bv, remuneration, date_paiement, intervenant_id, etude_id, nb_jeh")
    .not("date_paiement", "is", null)
    .is("intervenant_id", null)
    .order("date_paiement", { ascending: true })
  if (from) mq = mq.gte("date_paiement", from)
  if (to) mq = mq.lte("date_paiement", to)
  const { data: bvRows, error: mErr } = await mq
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })
```

⚠️ Le filtre passe de `numero_bv IS NOT NULL` à `date_paiement IS NOT NULL AND intervenant_id IS NULL` :
les missions dotées d'un intervenant ont été reprises dans `retributions` par la migration 067,
les compter ici les ferait apparaître deux fois.

- [ ] **Step 2 : Construire les lignes exportées**

Remplacer les blocs de lookup et `bulletinRows` (lignes 64-110) par :

```ts
  // Lookups études + intervenants en 2 requêtes (pas de jointure fragile).
  const etudeIds = Array.from(
    new Set(
      [
        ...(factures || []).map((r: any) => r.etude_id),
        ...(bvRows || []).map((r: any) => r.etude_id),
        ...(retributionRows || []).map((r: any) => r.missions?.etude_id),
      ].filter(Boolean)
    )
  )
  const intervenantIds = Array.from(
    new Set((retributionRows || []).map((r: any) => r.personne_id).filter(Boolean))
  )
  const [etudesRes, persRes] = await Promise.all([
    etudeIds.length
      ? sb.from("etudes").select("id, numero, nom").in("id", etudeIds)
      : Promise.resolve({ data: [] as any[] }),
    intervenantIds.length
      ? sb.from("personnes").select("id, prenom, nom").in("id", intervenantIds)
      : Promise.resolve({ data: [] as any[] }),
  ])
  const etudeById = new Map((etudesRes.data || []).map((e: any) => [e.id, e]))
  const persById = new Map((persRes.data || []).map((p: any) => [p.id, p]))

  const libelleEtude = (id: string | null | undefined) => {
    const e = id ? etudeById.get(id) : null
    return e ? `${e.numero ?? ""} ${e.nom ?? ""}`.trim() : ""
  }

  const factureRows = (factures || []).map((f: any) => {
    return {
      numero: f.numero,
      nom: f.nom ?? "",
      etude: libelleEtude(f.etude_id),
      montant_ht: Number(f.montant_ht ?? 0),
      date_emission: f.date_emission ?? "",
      date_echeance: f.date_echeance ?? "",
      date_paiement: f.date_paiement ?? "",
      statut: f.date_paiement ? "Payée" : "En attente",
      notes: f.notes ?? "",
    }
  })

  const bulletinRows = [
    ...(retributionRows || []).map((r: any) => {
      const p = persById.get(r.personne_id)
      return {
        numero_bv: r.numero_bv ?? "",
        intervenant: p ? `${p.prenom ?? ""} ${p.nom ?? ""}`.trim() : "",
        etude: libelleEtude(r.missions?.etude_id),
        mission: r.missions?.nom ?? "",
        nb_jeh: Number(r.missions?.nb_jeh ?? 0),
        montant: Number(r.montant ?? 0),
        date_paiement: r.date_paiement ?? "",
      }
    }),
    // Missions payées sans intervenant identifié : conservées pour que le
    // total exporté corresponde toujours à la trésorerie réelle.
    ...(bvRows || []).map((m: any) => ({
      numero_bv: m.numero_bv ?? "",
      intervenant: "(intervenant non renseigné)",
      etude: libelleEtude(m.etude_id),
      mission: m.nom ?? "",
      nb_jeh: Number(m.nb_jeh ?? 0),
      montant: Number(m.remuneration ?? 0) * Number(m.nb_jeh ?? 0),
      date_paiement: m.date_paiement ?? "",
    })),
  ]
```

- [ ] **Step 3 : Mettre à jour les colonnes XLSX**

Remplacer les colonnes de la feuille « Bulletins de versement » (lignes 151-158) par :

```ts
  wsB.columns = [
    { header: "N° BV", key: "numero_bv", width: 14 },
    { header: "Intervenant", key: "intervenant", width: 26 },
    { header: "Étude", key: "etude", width: 28 },
    { header: "Mission", key: "mission", width: 30 },
    { header: "Nb JEH", key: "nb_jeh", width: 10 },
    { header: "Montant (€)", key: "montant", width: 16, style: { numFmt: "#,##0.00" } },
    { header: "Date de paiement", key: "date_paiement", width: 16 },
  ]
```

Mettre également à jour le commentaire d'en-tête du fichier (ligne 14) :

```ts
 * Filtres : factures sur date_emission, BV sur retributions.date_paiement.
```

- [ ] **Step 4 : Vérifier compilation et lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: aucune erreur.

- [ ] **Step 5 : Vérifier l'export**

Depuis `/tresorerie`, lancer « Export Excel » sans filtre de date, ouvrir le fichier : la feuille « Bulletins de versement » liste une ligne par intervenant payé, avec sa mission et son montant.

- [ ] **Step 6 : Commit**

```bash
git add app/api/tresorerie/export/route.ts
git commit -m "feat(tresorerie): export comptable des BV par intervenant"
```

---

### Task 10 : Vérification finale

**Files:** aucun (vérification)

- [ ] **Step 1 : Lancer toute la suite de tests**

Run: `npm run test`
Expected: PASS, y compris les 18 tests de `lib/tresorerie/retributions.test.ts`.

- [ ] **Step 2 : Typecheck + lint complets**

Run: `npx tsc --noEmit && npm run lint`
Expected: aucune erreur.

- [ ] **Step 3 : Rebuild du graphe graphify**

Run: `$(cat graphify-out/.graphify_python) -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"`
Expected: rebuild terminé sans erreur.

- [ ] **Step 4 : Signaler la migration à appliquer**

Dire explicitement à Felix : **`supabase/migrations/067_retributions_intervenants.sql` doit être exécutée manuellement dans le dashboard Supabase**. Tant qu'elle ne l'est pas, la page affiche les lignes par intervenant mais l'enregistrement d'un paiement individuel renvoie « Migration 067 non appliquée ».

---

## Phase 2 (hors périmètre de ce plan)

Génération automatique des bulletins de versement : un modèle Word de catégorie `bv` uploadé dans les paramètres, puis un bouton « Générer les BV » par mission qui appelle `/api/documents/generate` (scope `mission`, `intervenant_id` de chaque ligne) et stocke le numéro généré dans `retributions.numero_bv`. Le socle posé ici ne nécessite aucune migration supplémentaire.
