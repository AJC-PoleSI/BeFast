import { describe, it, expect, vi } from "vitest"
import { PDFDocument } from "pdf-lib"

vi.mock("server-only", () => ({}))

import { fillBaPdf } from "./ba-pdf"

/** PDF d'une page portant deux des champs du BA, comme le template réel. */
async function templateDeTest(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])
  const form = pdf.getForm()
  form.createTextField("nom_complet").addToPage(page, { x: 140, y: 620, width: 150, height: 15 })
  form.createTextField("promo").addToPage(page, { x: 340, y: 560, width: 130, height: 15 })
  return pdf.save()
}

async function relire(bytes: Uint8Array) {
  return (await PDFDocument.load(bytes)).getForm()
}

describe("fillBaPdf", () => {
  it("aplatit par défaut (envoi en signature)", async () => {
    const out = await fillBaPdf(await templateDeTest(), { nom_complet: "Jean Dupont" })
    expect((await relire(out)).getFields()).toHaveLength(0)
  })

  it("laisse les champs modifiables sans aplatir (BA téléchargé)", async () => {
    const out = await fillBaPdf(
      await templateDeTest(),
      { nom_complet: "Hélène Dupré", promo: "" },
      { flatten: false }
    )
    const form = await relire(out)
    expect(form.getTextField("nom_complet").getText()).toBe("Hélène Dupré")
    // Case vide : reste à compléter par la personne.
    expect(form.getTextField("promo").getText() ?? "").toBe("")
  })

  it("réduit la police d'un texte qui déborderait de sa case", async () => {
    const taille = async (nom: string) => {
      const out = await fillBaPdf(await templateDeTest(), { nom_complet: nom }, { flatten: false })
      const da = (await relire(out)).getTextField("nom_complet").acroField.getDefaultAppearance()
      return Number(/([\d.]+)\s+Tf/.exec(da ?? "")?.[1] ?? 0)
    }
    const court = await taille("Jean Dupont")
    const long = await taille("Marie-Charlotte de La Rochefoucauld-Saint-Exupéry")
    expect(long).toBeGreaterThanOrEqual(6)
    expect(long).toBeLessThan(court || 10)
  })

  it("ne plante pas sur un nom hors du jeu de la police", async () => {
    const out = await fillBaPdf(
      await templateDeTest(),
      { nom_complet: "Łukasz Şahin" },
      { flatten: false }
    )
    expect((await relire(out)).getTextField("nom_complet").getText()).toBe("Lukasz Sahin")
  })
})
