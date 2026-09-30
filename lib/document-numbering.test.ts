import { describe, it, expect } from "vitest"
import {
  numeroEtudeCourt,
  codeClasseurEtude,
  segmentRdmParent,
  referenceRdmIntervenant,
  referenceConventionEtude,
} from "./document-numbering"

describe("numeroEtudeCourt", () => {
  it("raccourcit le code classeur stocké en base à 2 chiffres", () => {
    expect(numeroEtudeCourt("2618")).toBe("18")
    expect(numeroEtudeCourt("2620")).toBe("20")
    expect(numeroEtudeCourt("2601")).toBe("01")
  })

  it("laisse un numéro déjà court inchangé et complète sur 2 chiffres", () => {
    expect(numeroEtudeCourt("18")).toBe("18")
    expect(numeroEtudeCourt("7")).toBe("07")
  })

  it("ignore les séparateurs des numéros historiques", () => {
    expect(numeroEtudeCourt("2026-00")).toBe("00")
    expect(numeroEtudeCourt("2024-001")).toBe("01")
  })

  it("renvoie une chaîne vide sans numéro", () => {
    expect(numeroEtudeCourt("")).toBe("")
    expect(numeroEtudeCourt(null)).toBe("")
    expect(numeroEtudeCourt(undefined)).toBe("")
  })
})

describe("codeClasseurEtude", () => {
  it("conserve le code classeur AA+NN sur 4 chiffres", () => {
    expect(codeClasseurEtude("2618")).toBe("2618")
    expect(codeClasseurEtude("2620")).toBe("2620")
  })

  it("reconstruit AA+NN depuis un numéro long historique", () => {
    expect(codeClasseurEtude("2026-00")).toBe("2600")
  })

  it("complète avec l'année quand le numéro ne porte que l'étude", () => {
    expect(codeClasseurEtude("18", 2026)).toBe("2618")
    expect(codeClasseurEtude("7", 2027)).toBe("2707")
  })

  it("renvoie une chaîne vide sans numéro", () => {
    expect(codeClasseurEtude("")).toBe("")
    expect(codeClasseurEtude(null)).toBe("")
  })
})

describe("segmentRdmParent", () => {
  it("extrait le RDM parent de la référence du RDM", () => {
    expect(segmentRdmParent("26 RDM01 18")).toBe("RDM01")
    expect(segmentRdmParent("26 RDM08 07.docx")).toBe("RDM08")
  })

  it("renvoie une chaîne vide quand aucun RDM n'est référencé", () => {
    expect(segmentRdmParent("26 CE 18")).toBe("")
    expect(segmentRdmParent("")).toBe("")
    expect(segmentRdmParent(null)).toBe("")
  })
})

describe("referenceConventionEtude", () => {
  it("compose la référence de la convention d'étude citée dans l'objet des factures", () => {
    expect(referenceConventionEtude("2620")).toBe("26CE20")
    expect(referenceConventionEtude("2618")).toBe("26CE18")
    expect(referenceConventionEtude("2026-22")).toBe("26CE22")
  })

  it("renvoie une chaîne vide sans numéro", () => {
    expect(referenceConventionEtude("")).toBe("")
    expect(referenceConventionEtude(null)).toBe("")
  })
})

describe("referenceRdmIntervenant", () => {
  // Du plus récent au plus ancien, comme la requête (created_at desc).
  const rdms = [
    { file_name: "26 RDM03 20.docx", intervenant_id: "b" },
    { file_name: "26 RDM02 20.docx", intervenant_id: "a" },
    { file_name: "26 RDM01 20.docx", intervenant_id: null },
  ]

  it("prend le RDM de l'intervenant, jamais celui d'un autre", () => {
    expect(referenceRdmIntervenant(rdms, "a")).toBe("26 RDM02 20")
    expect(referenceRdmIntervenant(rdms, "b")).toBe("26 RDM03 20")
  })

  it("se rabat sur un ancien RDM non rattaché", () => {
    expect(referenceRdmIntervenant(rdms, "c")).toBe("26 RDM01 20")
    expect(referenceRdmIntervenant(rdms.slice(0, 2), "c")).toBe("")
  })

  it("prend le dernier RDM sans intervenant désigné", () => {
    expect(referenceRdmIntervenant(rdms, null)).toBe("26 RDM03 20")
    expect(referenceRdmIntervenant([], "a")).toBe("")
  })
})
