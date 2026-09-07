import { describe, it, expect } from "vitest"
import { totalDejaFacture, repartirVersements } from "./reconciliation"

describe("repartirVersements", () => {
  it("acompte + solde retombent exactement sur le Total HT", () => {
    const parts = repartirVersements(5000, [60, 40])
    expect(parts).toEqual([3000, 2000])
    expect(parts.reduce((s, m) => s + m, 0)).toBe(5000)
  })

  it("le dernier versement absorbe l'arrondi (schéma PVRI 40/30/30)", () => {
    const total = 3333.33
    const parts = repartirVersements(total, [40, 30, 30])
    expect(Math.round(parts.reduce((s, m) => s + m, 0) * 100) / 100).toBe(total)
  })

  it("supporte un acompte à un pourcentage libre choisi par le trésorier", () => {
    for (const pct of [25, 33.33, 50, 70]) {
      const parts = repartirVersements(5000, [pct, 100 - pct])
      expect(Math.round(parts.reduce((s, m) => s + m, 0) * 100) / 100).toBe(5000)
    }
  })
})

describe("totalDejaFacture", () => {
  const acompte = { montant_ht: 3000, date_emission: "2026-05-18", numero_dans_etude: 1 }
  const solde = { montant_ht: 2000, date_emission: "2026-07-13", numero_dans_etude: 2 }

  it("l'acompte ne déduit rien", () => {
    expect(totalDejaFacture(acompte, [solde])).toBe(0)
  })

  it("le solde déduit l'acompte", () => {
    expect(totalDejaFacture(solde, [acompte])).toBe(3000)
  })

  it("une facture non émise n'est jamais comptée comme déjà facturée", () => {
    // Régression : en se fiant à la seule date d'émission, un brouillon de
    // solde était déduit de l'acompte, et un brouillon quelconque venait
    // grossir la déduction du solde.
    const brouillon = { montant_ht: 900, date_emission: null, numero_dans_etude: 3 }
    expect(totalDejaFacture(solde, [acompte, brouillon])).toBe(3000)
    expect(totalDejaFacture(acompte, [solde, brouillon])).toBe(0)
  })

  it("classe sur le rang dans l'étude quand aucune facture n'est émise", () => {
    const a = { montant_ht: 3000, date_emission: null, numero_dans_etude: 1 }
    const b = { montant_ht: 2000, date_emission: null, numero_dans_etude: 2 }
    expect(totalDejaFacture(a, [b])).toBe(0)
    expect(totalDejaFacture(b, [a])).toBe(3000)
  })

  it("acompte + solde reconstituent le Total HT de l'étude", () => {
    const totalHt = 5000
    expect(totalDejaFacture(solde, [acompte]) + Number(solde.montant_ht)).toBe(totalHt)
  })
})
