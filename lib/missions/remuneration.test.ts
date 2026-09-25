import { describe, it, expect } from "vitest"
import {
  formatEuros,
  jehTotalMission,
  montantTotalMission,
  remunerationParIntervenant,
  remunerationParJeh,
} from "./remuneration"

// Cas réel (étude 2620) : 26 intervenants, 2 JEH chacun, 311 € par intervenant.
const contenus = { nb_jeh: 2, nb_intervenants: 26, remuneration: 311 }

describe("barème d'une mission", () => {
  it("verse à chaque intervenant la rémunération saisie, quel que soit son nombre de JEH", () => {
    expect(remunerationParIntervenant(contenus)).toBe(311)
    expect(remunerationParIntervenant({ ...contenus, nb_jeh: 4 })).toBe(311)
  })

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
    const deux = { ...contenus, nb_intervenants: 2 }
    expect(jehTotalMission(deux)).toBe(4)
    expect(montantTotalMission(deux)).toBe(622)
    expect(remunerationParJeh(deux)).toBe(155.5)
  })

  it("lit les numeric renvoyés en chaîne par Supabase", () => {
    const m = { nb_jeh: "2.0", nb_intervenants: 26, remuneration: "311.00" }
    expect(jehTotalMission(m)).toBe(52)
    expect(montantTotalMission(m)).toBe(8086)
  })

  it("vaut 1 intervenant quand nb_intervenants est absent, 0 quand il est explicitement 0", () => {
    expect(montantTotalMission({ nb_jeh: 2, remuneration: 311 })).toBe(311)
    expect(jehTotalMission({ nb_jeh: 2 })).toBe(2)
    expect(montantTotalMission({ nb_jeh: 2, nb_intervenants: 0, remuneration: 311 })).toBe(0)
  })

  it("replie sur taux_jour (tarif PAR JEH) pour les missions issues d'une proposition", () => {
    const m = { nb_jeh: 3, nb_intervenants: 2, remuneration: null, taux_jour: 100 }
    expect(remunerationParIntervenant(m)).toBe(300)
    expect(remunerationParJeh(m)).toBe(100)
    expect(montantTotalMission(m)).toBe(600)
  })

  it("renvoie 0 / null quand aucun barème n'est saisi", () => {
    const m = { nb_jeh: 2, nb_intervenants: 3, remuneration: null, taux_jour: null }
    expect(remunerationParIntervenant(m)).toBe(0)
    expect(remunerationParJeh(m)).toBeNull()
    expect(montantTotalMission(m)).toBe(0)
  })

  it("ne divise pas par zéro quand la mission n'a pas de JEH", () => {
    expect(remunerationParJeh({ nb_jeh: 0, remuneration: 311 })).toBeNull()
    expect(montantTotalMission({ nb_jeh: 0, nb_intervenants: 2, remuneration: 311 })).toBe(622)
  })

  it("arrondit au centime", () => {
    expect(remunerationParJeh({ nb_jeh: 3, remuneration: 100 })).toBe(33.33)
  })
})

describe("formatEuros", () => {
  // fr-FR sépare les milliers par une espace fine insécable (U+202F).
  const f = (n: number) => formatEuros(n).replace(/ | /g, " ")

  it("affiche les montants ronds sans décimales", () => {
    expect(f(311)).toBe("311 €")
    expect(f(8086)).toBe("8 086 €")
  })

  it("affiche toujours deux décimales quand il y a des centimes", () => {
    expect(f(155.5)).toBe("155,50 €")
    expect(f(33.33)).toBe("33,33 €")
  })
})
