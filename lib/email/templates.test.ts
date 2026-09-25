import { describe, it, expect, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { intervenantAffecteEmail } from "./templates"

describe("intervenantAffecteEmail", () => {
  it("annonce une sélection, pas une candidature acceptée", () => {
    const tpl = intervenantAffecteEmail({
      prenom: "Léa",
      missionNom: "Création de contenus",
      chefsDeProjet: ["Baptiste Le Bec"],
    })
    expect(tpl.subject).toContain("Création de contenus")
    expect(tpl.subject).not.toMatch(/candidature/i)
    expect(tpl.html).toContain("sélectionné")
    expect(tpl.html).toContain("Baptiste Le Bec")
  })

  it("échappe les valeurs injectées dans le HTML", () => {
    const tpl = intervenantAffecteEmail({
      prenom: "<b>x</b>",
      missionNom: "<script>alert(1)</script>",
      chefsDeProjet: [],
    })
    expect(tpl.html).not.toContain("<script>")
    expect(tpl.html).not.toContain("<b>x</b>")
  })
})
