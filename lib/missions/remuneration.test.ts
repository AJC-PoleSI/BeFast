import { describe, it, expect } from "vitest"
import {
  jehTotalMission,
  montantTotalMission,
  remunerationParJeh,
} from "./remuneration"

// Cas réel (étude 2620) : 26 intervenants, 2 JEH chacun, 311 € par intervenant.
const contenus = { nb_jeh: 2, nb_intervenants: 26, remuneration: 311 }

describe("barème d'une mission", () => {
  it("compte les JEH par intervenant : 2 JEH × 26 intervenants = 52 JEH", () => {
    expect(jehTotalMission(contenus)).toBe(52)
  })

  it("répartit la rémunération d'un intervenant sur ses JEH : 311 € / 2 JEH = 155,50 €", () => {
    expect(remunerationParJeh(contenus)).toBe(155.5)
  })

  it("totalise rémunération × intervenants, sans la multiplier par les JEH", () => {
    expect(montantTotalMission(contenus)).toBe(8086)
  })

  it("donne le même montant par intervenant quel que soit le nombre d'intervenants", () => {
    expect(montantTotalMission({ ...contenus, nb_intervenants: 2 })).toBe(622)
    expect(remunerationParJeh({ ...contenus, nb_intervenants: 2 })).toBe(155.5)
  })

  it("lit les numeric renvoyés en chaîne par Supabase", () => {
    const m = { nb_jeh: "2.0", nb_intervenants: 26, remuneration: "311.00" }
    expect(jehTotalMission(m)).toBe(52)
    expect(montantTotalMission(m)).toBe(8086)
  })

  it("vaut 1 intervenant quand nb_intervenants est absent", () => {
    expect(montantTotalMission({ nb_jeh: 2, remuneration: 311 })).toBe(311)
    expect(jehTotalMission({ nb_jeh: 2 })).toBe(2)
  })

  it("replie sur taux_jour (tarif PAR JEH) pour les missions issues d'une proposition", () => {
    const m = { nb_jeh: 3, nb_intervenants: 2, remuneration: null, taux_jour: 100 }
    expect(remunerationParJeh(m)).toBe(100)
    expect(montantTotalMission(m)).toBe(600)
  })

  it("renvoie null / 0 quand aucun barème n'est saisi", () => {
    const m = { nb_jeh: 2, nb_intervenants: 3, remuneration: null, taux_jour: null }
    expect(remunerationParJeh(m)).toBeNull()
    expect(montantTotalMission(m)).toBe(0)
  })

  it("ne divise pas par zéro quand la mission n'a pas de JEH", () => {
    expect(remunerationParJeh({ nb_jeh: 0, remuneration: 311 })).toBeNull()
    expect(montantTotalMission({ nb_jeh: 0, nb_intervenants: 2, remuneration: 311 })).toBe(622)
  })
})
