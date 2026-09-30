import { describe, it, expect } from "vitest"
import { champsManquantsBv, messageBvIncomplet } from "./verification"

const intervenant = {
  id: "p1", nom: "EXEMPLE", prenom: "Camille", adresse: "12 rue du Test",
  code_postal: "44000", ville: "Nantes", num_secu: "2 00 00 00 000 000 00",
}
const mission = { reference_recap_mission: "26 RDM02 20", nombre_jeh: 1, montant_remuneration: 146 }

describe("contrôle d'un BV avant génération", () => {
  it("laisse passer un BV complet", () => {
    expect(champsManquantsBv({ intervenant, mission })).toEqual([])
  })

  it("liste ce qui manque", () => {
    expect(
      champsManquantsBv({
        intervenant: { ...intervenant, adresse: " ", num_secu: "" },
        mission: { ...mission, reference_recap_mission: "" },
      })
    ).toEqual(["adresse", "numéro de sécurité sociale", "la référence de son RDM"])
    expect(champsManquantsBv({ intervenant, mission: { ...mission, nombre_jeh: 0, montant_remuneration: 0 } })).toEqual([
      "le nombre de JEH de la mission",
      "la rétribution de la mission",
    ])
  })

  it("exige un étudiant sélectionné", () => {
    expect(champsManquantsBv({ intervenant: {}, mission })).toEqual(["l'étudiant concerné (aucun intervenant sélectionné)"])
  })

  it("dit quoi faire", () => {
    expect(messageBvIncomplet(["adresse"])).toMatch(/^BV non généré, il manque : adresse\. Complétez la fiche/)
  })
})
