import { describe, it, expect } from "vitest"
import { computeBudget, type BudgetInput } from "./compute"

const base: BudgetInput = {
  phases: [],
  suiviJehCount: 0,
  suiviJehPrice: 0,
  margeJePct: 0,
  fraisDossier: 0,
  globalFraisAnnexes: 0,
}

describe("computeBudget", () => {
  it("sums phases and applies default 20% TVA", () => {
    const b = computeBudget({
      ...base,
      phases: [{ name: "Cadrage", jehCount: 10, jehPrice: 100 }],
    })
    expect(b.totalPhasesJeh).toBe(1000)
    expect(b.totalHt).toBe(1000)
    expect(b.tva).toBe(200)
    expect(b.netAPayer).toBe(1200)
  })

  it("treats marge as a grossissement of the SDP (base/(1-marge%))", () => {
    // base=100, marge=38% → ceil(100/0.62)=162 → margeJe=62 (doc example).
    const b = computeBudget({
      ...base,
      phases: [{ name: "P", jehCount: 1, jehPrice: 100 }],
      margeJePct: 38,
    })
    expect(b.margeJe).toBe(62)
    expect(b.totalJehHt).toBe(162)
  })

  it("includes suivi in the marge base", () => {
    // base = phases(100) + suivi(100) = 200 ; marge 38% → ceil(200/0.62)=323 → 123
    const b = computeBudget({
      ...base,
      phases: [{ name: "P", jehCount: 1, jehPrice: 100 }],
      suiviJehCount: 1,
      suiviJehPrice: 100,
      margeJePct: 38,
    })
    expect(b.suiviTotal).toBe(100)
    expect(b.margeJe).toBe(123)
  })

  it("adds fraisDossier + globalFraisAnnexes into fraisStructure", () => {
    const b = computeBudget({ ...base, fraisDossier: 50, globalFraisAnnexes: 30 })
    expect(b.fraisStructure).toBe(80)
    expect(b.totalHt).toBe(80)
  })

  it("charges TVA on the whole HT, frais de structure included", () => {
    // JEH HT = 1000, frais = 80 → TVA = 20% de 1080 (assiette des factures AJC).
    const b = computeBudget({
      ...base,
      phases: [{ name: "P", jehCount: 10, jehPrice: 100 }],
      fraisDossier: 50,
      globalFraisAnnexes: 30,
    })
    expect(b.totalHt).toBe(1080)
    expect(b.tva).toBe(216)
    expect(b.netAPayer).toBe(1296)
  })

  it("reproduces the AJC invoice example (5 000 HT → 1 000 de TVA → 6 000 TTC)", () => {
    const b = computeBudget({
      ...base,
      phases: [
        { name: "Recueil terrain & grille", jehCount: 2, jehPrice: 439 },
        { name: "Benchmark & tests des produits", jehCount: 2, jehPrice: 439 },
        { name: "Matrice comparative & livrables", jehCount: 2, jehPrice: 439 },
      ],
      suiviJehCount: 6,
      suiviJehPrice: 361,
      fraisDossier: 200,
    })
    expect(b.totalJehHt).toBe(4800)
    expect(b.totalHt).toBe(5000)
    expect(b.tva).toBe(1000)
    expect(b.netAPayer).toBe(6000)
    expect(b.versements.map((v) => v.montant)).toEqual([3600, 2400])
  })

  it("folds the marge into per-line unit prices (lines sum to totalJehHt)", () => {
    const b = computeBudget({
      ...base,
      phases: [
        { name: "A", jehCount: 2, jehPrice: 100 },
        { name: "B", jehCount: 3, jehPrice: 120 },
      ],
      suiviJehCount: 2,
      suiviJehPrice: 90,
      margeJePct: 38,
    })
    // Chaque ligne reste cohérente : jeh × prix unitaire = montant.
    for (const p of b.phases) {
      expect(p.montantMarge).toBe(Math.round(p.jeh * p.prixJehMarge * 100) / 100)
      expect(p.prixJehMarge).toBeGreaterThan(p.prixJeh)
    }
    const somme =
      b.phases.reduce((s, p) => s + p.montantMarge, 0) + b.suiviTotalMarge
    expect(Math.round(somme * 100) / 100).toBe(b.totalJehHt)
    expect(b.margeJe).toBe(Math.round((b.totalJehHt - 740) * 100) / 100)
  })

  it("leaves unit prices untouched when marge is 0", () => {
    const b = computeBudget({
      ...base,
      phases: [{ name: "P", jehCount: 2, jehPrice: 439 }],
      suiviJehCount: 1,
      suiviJehPrice: 361,
    })
    expect(b.phases[0].prixJehMarge).toBe(439)
    expect(b.suiviPrixJehMarge).toBe(361)
    expect(b.margeJe).toBe(0)
  })

  it("supports a 0% TVA (netAPayer == totalHt)", () => {
    const b = computeBudget({
      ...base,
      phases: [{ name: "P", jehCount: 1, jehPrice: 100 }],
      tvaPct: 0,
    })
    expect(b.tva).toBe(0)
    expect(b.netAPayer).toBe(b.totalHt)
  })

  it("default versements (standard 60/40) sum exactly to netAPayer", () => {
    const b = computeBudget({
      ...base,
      phases: [{ name: "P", jehCount: 3, jehPrice: 100 }],
    })
    const sum = b.versements.reduce((s, v) => s + v.montant, 0)
    expect(b.paiementType).toBe("standard")
    expect(b.versements).toHaveLength(2)
    expect(Math.round(sum * 100) / 100).toBe(b.netAPayer)
  })

  it("custom versements: the last absorbs the rounding remainder", () => {
    // netAPayer with an awkward total to force a rounding split.
    const b = computeBudget({
      ...base,
      phases: [{ name: "P", jehCount: 1, jehPrice: 333.33 }],
      paiementModalites: {
        type: "pvri",
        versements: [
          { label: "Acompte", pct: 40 },
          { label: "PVRI", pct: 30 },
          { label: "Solde", pct: 30 },
        ],
      },
    })
    const sum = b.versements.reduce((s, v) => s + v.montant, 0)
    expect(b.versements).toHaveLength(3)
    expect(Math.round(sum * 100) / 100).toBe(b.netAPayer)
  })

  it("is resilient to empty / zero input", () => {
    const b = computeBudget({ ...base })
    expect(b.totalHt).toBe(0)
    expect(b.netAPayer).toBe(0)
    expect(b.phases).toEqual([])
  })
})
