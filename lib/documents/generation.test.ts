import { describe, it, expect } from "vitest"
import { nomDocument, ouvrirCompteurs } from "./generation"
import { CATEGORY_CODES, CATEGORIES_PAR_INTERVENANT } from "./nomenclature"

const base = { scope: "mission", annee: "26", numeroEtude: "18", rdmParent: "" }

describe("nomDocument — nomenclature SDP", () => {
  it("RDM numéroté : 26 RDM01 18", () => {
    expect(nomDocument({ ...base, category: "rdm", numero: 1 })).toBe("26 RDM01 18")
  })
  it("avenant au RDM : rappelle le RDM parent", () => {
    expect(nomDocument({ ...base, category: "avenant_rdm", numero: 2, rdmParent: "RDM01" })).toBe("26 AV02 RDM01 18")
  })
  it("avenant de rupture : AR, et le compteur continue celui des avenants du RDM", () => {
    expect(nomDocument({ ...base, category: "avenant_rupture_rdm", numero: 2, rdmParent: "RDM09" })).toBe("26 AR02 RDM09 18")
  })
  it("avenant à la convention d'étude : 26 AV01 CE18", () => {
    expect(nomDocument({ ...base, scope: "etude", category: "avenant_mission", numero: 1 })).toBe("26 AV01 CE18")
  })
  it("catégorie non numérotée : pas de compteur", () => {
    expect(nomDocument({ ...base, category: "convention_etude", numero: 1 })).toBe("26 CE 18")
  })
  it("le RDM parent n'apparaît que pour les avenants", () => {
    expect(nomDocument({ ...base, category: "rdm", numero: 3, rdmParent: "RDM01" })).toBe("26 RDM03 18")
  })
  it("facture : son propre numéro", () => {
    expect(nomDocument({ ...base, scope: "facture", category: "facture", numero: 1, factureNumero: "FA-26-004" })).toBe("FA-26-004")
  })
})

/** Faux client Supabase : renvoie des lignes fixes pour la table interrogée. */
function faux(lignes: { file_name: string }[]) {
  const chaine: any = {
    select: () => chaine,
    eq: () => chaine,
    in: () => chaine,
    or: () => chaine,
    then: (ok: any) => ok({ data: lignes, count: lignes.length }),
  }
  return { from: () => chaine } as any
}

describe("ouvrirCompteurs", () => {
  const tpl = (category: string) => ({ id: "t", name: "x", category, file_path: "a.docx" })

  it("avenants : le compteur repart de 1 pour chaque RDM parent", async () => {
    const c = await ouvrirCompteurs(
      faux([{ file_name: "26 AV01 RDM01 18.docx" }, { file_name: "26 AV02 RDM01 18.docx" }, { file_name: "26 AV01 RDM02 18.docx" }]),
      tpl("avenant_rdm"), "mission", "m", "e"
    )
    expect(c.suivant("RDM01")).toBe(3)
    expect(c.suivant("RDM02")).toBe(2)
    expect(c.suivant("RDM09")).toBe(1)
  })

  it("génération groupée : numéros attribués à la suite, sans doublon", async () => {
    const c = await ouvrirCompteurs(faux([]), tpl("avenant_rdm"), "mission", "m", "e")
    expect([c.suivant("RDM01"), c.suivant("RDM01"), c.suivant("RDM01")]).toEqual([1, 2, 3])
  })

  it("catégorie non numérotée : toujours 1", async () => {
    const c = await ouvrirCompteurs(faux([]), tpl("convention_etude"), "etude", "e", "e")
    expect(c.suivant("")).toBe(1)
  })
})

describe("nomenclature partagée", () => {
  it("les avenants sont des documents par intervenant et rappellent le RDM", () => {
    for (const cat of ["avenant_rdm", "avenant_rupture_rdm"]) {
      expect(CATEGORIES_PAR_INTERVENANT.has(cat)).toBe(true)
      expect(CATEGORY_CODES[cat].parentRdm).toBe(true)
    }
  })
})
