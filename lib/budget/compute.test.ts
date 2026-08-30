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

  it("does not charge TVA on frais de structure (JEH only)", () => {
    // JEH HT = 1000, frais = 80 → TVA = 20% de 1000 (pas de 1080).
    const b = computeBudget({
      ...base,
      phases: [{ name: "P", jehCount: 10, jehPrice: 100 }],
      fraisDossier: 50,
      globalFraisAnnexes: 30,
    })
    expect(b.totalHt).toBe(1080)
    expect(b.tva).toBe(200)
    expect(b.netAPayer).toBe(1280)
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
