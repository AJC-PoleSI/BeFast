import { describe, it, expect } from "vitest"
import { lignesFacture } from "./lignes"

// Cas réel : facture 26049, étude 2618.2 saisie à la main (sans proposition).
// Les blocs de l'échéancier n'ont pas de prix, seulement le JEH total de leur
// mission ; budget HT de l'étude = 10 070 €, marge 34 %.
const missions = [
  { id: "suivi", nb_jeh: 3, nb_intervenants: 2, remuneration: 600 },
  { id: "focus", nb_jeh: 1, nb_intervenants: 16, remuneration: 300 },
  { id: "analyse", nb_jeh: 2, nb_intervenants: 2, remuneration: 320 },
]
const blocs = [
  { mission_id: "suivi", jeh: 6, nombre_jeh: 0, prix_jeh: null },
  { mission_id: "focus", jeh: 16, nombre_jeh: 0, prix_jeh: null },
  { mission_id: "analyse", jeh: 4, nombre_jeh: 0, prix_jeh: null },
]

const somme = (lignes: { montant_ht: number }[]) =>
  Math.round(lignes.reduce((s, l) => s + l.montant_ht, 0) * 100) / 100

describe("lignesFacture", () => {
  it("prend le coût client de chaque mission quand le bloc n'a pas de prix (facture 26049)", () => {
    const lignes = lignesFacture(blocs, missions, { margePct: 34, totalPrestation: 10070 })
    expect(lignes).toEqual([
      { nombre_jeh: 6, prix_jeh: 303.33, montant_ht: 1820 },
      { nombre_jeh: 16, prix_jeh: 455, montant_ht: 7280 },
      { nombre_jeh: 4, prix_jeh: 242.5, montant_ht: 970 },
    ])
    expect(somme(lignes)).toBe(10070)
  })

  it("garde le prix porté par le bloc pour une étude issue d'une proposition", () => {
    const lignes = lignesFacture(
      [
        { nombre_jeh: 3, prix_jeh: 450 },
        { nombre_jeh: 2, prix_jeh: 425.5 },
      ],
      [],
      { margePct: 34, totalPrestation: 2201 }
    )
    expect(lignes).toEqual([
      { nombre_jeh: 3, prix_jeh: 450, montant_ht: 1350 },
      { nombre_jeh: 2, prix_jeh: 425.5, montant_ht: 851 },
    ])
  })

  it("recale les lignes sur le budget HT quand les missions n'y tombent pas pile", () => {
    const lignes = lignesFacture(blocs, missions, { margePct: 34, totalPrestation: 10000 })
    expect(somme(lignes)).toBe(10000)
    // Recalage proportionnel : la répartition entre lignes est conservée.
    expect(lignes[1].montant_ht).toBeGreaterThan(lignes[0].montant_ht)
    for (const l of lignes) expect(l.prix_jeh).toBe(Math.round((l.montant_ht / l.nombre_jeh) * 100) / 100)
  })

  it("répartit le budget au prorata des JEH quand aucune ligne n'a de prix ni de mission", () => {
    const lignes = lignesFacture(
      [{ jeh: 6 }, { jeh: 4 }],
      [],
      { margePct: 34, totalPrestation: 1000 }
    )
    expect(lignes).toEqual([
      { nombre_jeh: 6, prix_jeh: 100, montant_ht: 600 },
      { nombre_jeh: 4, prix_jeh: 100, montant_ht: 400 },
    ])
  })

  it("ne recale pas une facture limitée à une phase (totalPrestation null)", () => {
    const lignes = lignesFacture([blocs[1]], missions, { margePct: 34, totalPrestation: null })
    expect(lignes).toEqual([{ nombre_jeh: 16, prix_jeh: 455, montant_ht: 7280 }])
  })

  it("laisse les lignes à zéro quand ni budget, ni prix, ni mission ne sont saisis", () => {
    const lignes = lignesFacture([{ jeh: 6 }], [], { margePct: 0, totalPrestation: 0 })
    expect(lignes).toEqual([{ nombre_jeh: 6, prix_jeh: 0, montant_ht: 0 }])
  })

  it("n'impute pas l'arrondi du recalage à une ligne sans JEH", () => {
    const lignes = lignesFacture(
      [{ jeh: 3 }, { jeh: 3 }, { jeh: 0 }],
      [],
      { margePct: 0, totalPrestation: 1000 }
    )
    expect(somme(lignes)).toBe(1000)
    expect(lignes[2]).toEqual({ nombre_jeh: 0, prix_jeh: 0, montant_ht: 0 })
  })
})
