import { describe, it, expect } from "vitest"
import {
  construireAvenant,
  dateLongue,
  montantEnLettres,
  referenceConvention,
  valeursParDefaut,
  validerChampsAvenant,
  type ContexteAvenant,
} from "./avenants"

const ctx: ContexteAvenant = {
  aujourdhuiISO: "2026-03-11",
  codeClasseur: "2603",
  mission: { description: "suivre le projet", date_fin_iso: "2026-04-12", nombre_jeh: 2, montant_remuneration: 311 },
  avenantsExistants: [],
}

describe("formats", () => {
  it("dates", () => {
    expect(dateLongue("2026-04-12")).toBe("12 avril 2026")
    expect(dateLongue("2026-03-01")).toBe("1er mars 2026")
    expect(dateLongue("")).toBe("")
  })
  it("montants en lettres : euro au singulier pour 0 et 1", () => {
    expect(montantEnLettres(0)).toBe("zéro euro")
    expect(montantEnLettres(1)).toBe("un euro")
    expect(montantEnLettres(311)).toBe("trois cent onze euros")
    expect(montantEnLettres(155.5)).toBe("cent cinquante-cinq euros et cinquante centimes")
  })
  it("convention", () => {
    expect(referenceConvention("2603")).toBe("26CE03")
  })
})

describe("validation", () => {
  it("avenant au RDM : objet et nouvelle date requis, au moins un alinéa", () => {
    const v = valeursParDefaut("avenant_rdm")
    expect(validerChampsAvenant("avenant_rdm", v).join(" ")).toMatch(/Objet de l'avenant/)
    expect(validerChampsAvenant("avenant_rdm", { ...v, objet: "x", date_fin_nouvelle: "2026-04-19" })).toEqual([])
    expect(
      validerChampsAvenant("avenant_rdm", { objet: "x", modifier_mission: false, modifier_delai: false, modifier_retribution: false })
    ).toEqual(["Cochez au moins un alinéa à modifier (mission, délai ou rétribution)."])
  })
  it("une date masquée n'est pas exigée", () => {
    const v = { ...valeursParDefaut("avenant_rdm"), objet: "x", modifier_delai: false }
    expect(validerChampsAvenant("avenant_rdm", v)).toEqual([])
  })
  it("rupture : valeurs par défaut valides une fois l'historique saisi", () => {
    const v = { ...valeursParDefaut("avenant_rupture_rdm"), historique: "Mission débutée…" }
    expect(validerChampsAvenant("avenant_rupture_rdm", v)).toEqual([])
  })
  it("avenant à la CE : alinéa complet requis", () => {
    const v = { ...valeursParDefaut("avenant_mission"), rappel_initial: "a", motifs: "b", conclusion: "c", objet_resume: "d" }
    expect(validerChampsAvenant("avenant_mission", v).join(" ")).toMatch(/au moins un alinéa/)
    expect(validerChampsAvenant("avenant_mission", { ...v, alineas: [{ titre: "Délais", article: "4", texte: "" }] }).join(" ")).toMatch(/Alinéa 1/)
  })
})

describe("construireAvenant — avenant au RDM", () => {
  const base = { objet: "Ligne 1\n\nLigne 2", modifier_mission: true, modifier_delai: true, date_fin_nouvelle: "2026-04-12" }

  it("numérote les alinéas selon ce qui est coché", () => {
    const a = construireAvenant("avenant_rdm", { ...base, modifier_mission: false }, ctx)
    expect(a.alineas.map((x: any) => [x.numero, x.titre])).toEqual([[1, "Délais"]])
    const b = construireAvenant("avenant_rdm", { ...base, modifier_retribution: true }, ctx)
    expect(b.alineas.map((x: any) => x.titre)).toEqual(["Définition de la Mission", "Délais", "Rétribution"])
  })
  it("découpe l'objet en paragraphes et reprend la description de la mission par défaut", () => {
    const a = construireAvenant("avenant_rdm", base, ctx)
    expect(a.objet_paragraphes).toEqual([{ texte: "Ligne 1" }, { texte: "Ligne 2" }])
    expect(a.alineas[0].texte).toContain("consiste en suivre le projet")
    expect(a.alineas[0].texte).toContain("26CE03")
    expect(a.alineas[1].texte).toContain("12 avril 2026")
  })
  it("cite l'avenant précédent du RDM (le plus récent)", () => {
    const a = construireAvenant("avenant_rdm", base, {
      ...ctx,
      avenantsExistants: [{ reference: "26 AV01 RDM01 03", categorie: "avenant_rdm" }],
    })
    expect(a.a_precedent).toBe(true)
    expect(a.precedent_ref).toBe("26 AV01 RDM01 03")
    expect(a.alineas[0].texte).toContain("et de l’Avenant 26 AV01 RDM01 03")
  })
  it("rétribution : valeurs de la mission par défaut, JEH accordés", () => {
    const a = construireAvenant("avenant_rdm", { ...base, modifier_retribution: true }, ctx)
    const r = a.alineas.find((x: any) => x.titre === "Rétribution")
    expect(r.texte).toContain("311 € bruts (trois cent onze euros bruts)")
    expect(r.texte).toContain("2 Jours-Étude Homme")
  })
  it("sans date_document : date du jour", () => {
    expect(construireAvenant("avenant_rdm", base, ctx).date_document).toBe("11 mars 2026")
    const a = construireAvenant("avenant_rdm", { ...base, date_document: "2026-03-27" }, ctx)
    expect([a.date_document, a.date_document_courte]).toEqual(["27 mars 2026", "27/03/2026"])
  })
})

describe("construireAvenant — rupture", () => {
  const v = { ...valeursParDefaut("avenant_rupture_rdm"), historique: "Débutée il y a trois semaines." }
  it("zéro JEH, zéro euro, au singulier", () => {
    const a = construireAvenant("avenant_rupture_rdm", v, ctx)
    expect(a.montant_lettres).toBe("zéro euro")
    expect(a.jeh_realises).toBe("0")
    expect(a.jeh_pluriel).toBe("")
    expect(a.accord_brut).toBe("brut")
    expect(construireAvenant("avenant_rupture_rdm", { ...v, montant_brut: 311 }, ctx).accord_brut).toBe("bruts")
  })
  it("constats : « Titre : texte » par ligne", () => {
    const a = construireAvenant("avenant_rupture_rdm", { ...v, constats: "Insuffisance de prospection : peu de contacts\nSans titre" }, ctx)
    expect(a.constats).toEqual([
      { titre: "Insuffisance de prospection :", texte: "peu de contacts" },
      { titre: "", texte: "Sans titre" },
    ])
    expect(a.a_constats).toBe(true)
  })
  it("annule les avenants au RDM précédents (pas les ruptures)", () => {
    const a = construireAvenant("avenant_rupture_rdm", v, {
      ...ctx,
      avenantsExistants: [
        { reference: "26 AV01 RDM09 03", categorie: "avenant_rdm" },
        { reference: "26 AV02 RDM09 03", categorie: "avenant_rdm" },
      ],
    })
    expect(a.avenants_annules).toBe("26 AV01 RDM09 03, 26 AV02 RDM09 03")
    expect(a.a_avenants_annules).toBe(true)
  })
})

describe("construireAvenant — convention d'étude", () => {
  it("alinéas numérotés avec l'article de la convention remplacé", () => {
    const a = construireAvenant(
      "avenant_mission",
      {
        rappel_initial: "r", motifs: "m1\nm2", conclusion: "c", objet_resume: "o",
        alineas: [{ titre: "Délais de réalisation", article: "4", texte: "Audencia Junior Conseil s'engage…" }],
      },
      ctx
    )
    expect(a.alineas).toEqual([
      { numero: 1, titre: "Délais de réalisation", intro: "L’article 4 de la Convention d’Etude est annulé et remplacé par :", texte: "Audencia Junior Conseil s'engage…" },
    ])
    expect(a.motifs_paragraphes).toHaveLength(2)
    expect(a.convention).toBe("26CE03")
  })
})
