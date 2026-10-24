import { describe, it, expect } from "vitest"
import { decouperEnEtapes, nomSansDates, resumeEtapes } from "./etapes"

const DESCRIPTION = "Création de contenus pour les réseaux sociaux d'Audencia."

describe("nomSansDates", () => {
  it("retire les dates collées au nom par l'import", () => {
    expect(nomSansDates("Ambassadeurs digitaux - Création de contenus stratégiques. 05/10/2026 → 31/01/2027")).toBe(
      "Ambassadeurs digitaux - Création de contenus stratégiques"
    )
  })
  it("laisse un nom sans dates intact", () => {
    expect(nomSansDates("Suivi de l'étude")).toBe("Suivi de l'étude")
    expect(nomSansDates(null)).toBe("")
  })
})

describe("decouperEnEtapes — RDM 26 RDM28 20 (2 JEH, 311 €, 05/10/2026 → 31/01/2027)", () => {
  const etapes = decouperEnEtapes({
    nom: "Ambassadeurs digitaux - Création de contenus stratégiques. 05/10/2026 → 31/01/2027",
    description: DESCRIPTION,
    nbJeh: 2,
    remuneration: 311,
    dateDebut: "2026-10-05",
    dateFin: "2027-01-31",
  })

  it("coupe en 8 puis 9 semaines, comme le RDM relu", () => {
    expect(etapes.map((e) => [e.debut, e.fin])).toEqual([
      ["05/10/2026", "29/11/2026"],
      ["30/11/2026", "31/01/2027"],
    ])
  })

  it("répartit la rétribution au prorata des jours (146 € + 165 €)", () => {
    expect(etapes.map((e) => e.retribution)).toEqual([146, 165])
    expect(etapes.reduce((s, e) => s + e.retribution, 0)).toBe(311)
  })

  it("nomme et décrit les étapes", () => {
    expect(etapes[0].intitule).toBe("Étape 1 : Ambassadeurs digitaux - Création de contenus stratégiques")
    expect(etapes[0].contenu).toBe(DESCRIPTION)
    expect(etapes[1].intitule).toBe("Étape 2 : Poursuite de l'étape 1")
    expect(etapes[1].contenu).toBe("Poursuite de la mission décrite à l'étape 1, sans changement de nature du travail.")
    expect(etapes.map((e) => e.jeh)).toEqual([1, 1])
  })

  it("produit les phrases des articles 2 et 3", () => {
    expect(resumeEtapes(etapes)).toEqual({
      plusieurs_etapes: true,
      dates_fin_phases: "29/11/2026 (phase 1) et 31/01/2027 (phase 2)",
      detail_phases: ", dont 146€ bruts au titre de la phase 1 et 165€ bruts au titre de la phase 2",
    })
  })
})

describe("decouperEnEtapes — cas limites", () => {
  const base = { nom: "Mission", description: "Desc", remuneration: 300, dateDebut: "2026-10-05", dateFin: "2027-01-31" }

  it("1 JEH : une seule étape, aucun récapitulatif de phases", () => {
    const etapes = decouperEnEtapes({ ...base, nbJeh: 1 })
    expect(etapes).toHaveLength(1)
    expect(etapes[0]).toMatchObject({ intitule: "Étape 1 : Mission", jeh: 1, debut: "05/10/2026", fin: "31/01/2027", retribution: 300 })
    expect(resumeEtapes(etapes)).toEqual({ plusieurs_etapes: false, dates_fin_phases: "31/01/2027", detail_phases: "" })
  })

  it("sans dates : une seule étape portant tous les JEH", () => {
    const etapes = decouperEnEtapes({ ...base, nbJeh: 3, dateDebut: null, dateFin: null })
    expect(etapes).toHaveLength(1)
    expect(etapes[0]).toMatchObject({ jeh: 3, debut: "", fin: "" })
  })

  it("mission plus courte que son nombre de JEH : une seule étape", () => {
    expect(decouperEnEtapes({ ...base, nbJeh: 4, dateDebut: "2026-10-05", dateFin: "2026-10-19" })).toHaveLength(1)
  })

  it("3 JEH : trois étapes contiguës dont la somme des rétributions retombe juste", () => {
    const etapes = decouperEnEtapes({ ...base, nbJeh: 3, remuneration: 311 })
    expect(etapes).toHaveLength(3)
    expect(etapes[0].debut).toBe("05/10/2026")
    expect(etapes[2].fin).toBe("31/01/2027")
    expect(etapes.reduce((s, e) => s + e.retribution, 0)).toBe(311)
    expect(resumeEtapes(etapes).dates_fin_phases).toMatch(/\(phase 1\), .* \(phase 2\) et .* \(phase 3\)$/)
  })

  it("rétribution avec centimes : la somme reste exacte au centime", () => {
    const etapes = decouperEnEtapes({ ...base, nbJeh: 2, remuneration: 155.5 })
    expect(Math.round(etapes.reduce((s, e) => s + e.retribution, 0) * 100) / 100).toBe(155.5)
  })
})
