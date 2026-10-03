import { describe, it, expect } from "vitest"
import { documentDownloadName, contentDisposition } from "./download-name"

describe("documentDownloadName", () => {
  it("ajoute le nom de l'étudiant concerné (demande de Baptiste, 02/10/2026)", () => {
    expect(documentDownloadName("26 RDM03 20.docx", { prenom: "Felix", nom: "Pitz" })).toBe(
      "26 RDM03 20 - Felix Pitz.docx"
    )
  })

  it("garde le nom tel quel sans étudiant concerné", () => {
    expect(documentDownloadName("26 CE 20.docx", null)).toBe("26 CE 20.docx")
    expect(documentDownloadName("26 CE 20.docx", { prenom: null, nom: null })).toBe("26 CE 20.docx")
  })

  it("conserve l'extension, pptx compris", () => {
    expect(documentDownloadName("26 RDM08 07.pptx", { prenom: "Ève", nom: "Müller" })).toBe(
      "26 RDM08 07 - Ève Müller.pptx"
    )
  })

  it("se contente du prénom ou du nom s'il manque l'autre", () => {
    expect(documentDownloadName("26 BV01 20.docx", { prenom: "Felix", nom: null })).toBe(
      "26 BV01 20 - Felix.docx"
    )
  })

  it("retire les caractères interdits dans un nom de fichier", () => {
    expect(documentDownloadName("26 RDM03 20.docx", { prenom: " Jean/Paul ", nom: 'Dupont:"X"' })).toBe(
      "26 RDM03 20 - JeanPaul DupontX.docx"
    )
  })

  it("n'ajoute pas deux fois le nom", () => {
    expect(
      documentDownloadName("26 RDM03 20 - Felix Pitz.docx", { prenom: "Felix", nom: "Pitz" })
    ).toBe("26 RDM03 20 - Felix Pitz.docx")
  })
})

describe("contentDisposition", () => {
  it("donne un repli ASCII et le nom exact en UTF-8", () => {
    expect(contentDisposition("attachment", "26 RDM03 20 - Ève Müller.docx")).toBe(
      `attachment; filename="26 RDM03 20 - Eve Muller.docx"; filename*=UTF-8''26%20RDM03%2020%20-%20%C3%88ve%20M%C3%BCller.docx`
    )
  })

  it("supporte l'affichage en ligne", () => {
    expect(contentDisposition("inline", "a.pdf")).toBe(`inline; filename="a.pdf"; filename*=UTF-8''a.pdf`)
  })

  it("neutralise les guillemets du repli ASCII", () => {
    expect(contentDisposition("attachment", 'a"b.docx')).toContain(`filename="ab.docx"`)
  })
})
