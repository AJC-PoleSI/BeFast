import { describe, it, expect } from "vitest"
import { PARAMETRES_BV_2026, assietteCotisations, contexteCotisationsBv } from "./cotisations"

describe("cotisations du bulletin de versement", () => {
  it("calcule l'assiette forfaitaire : JEH × 4 × SMIC horaire (48,08 € en 2026)", () => {
    const a = assietteCotisations(PARAMETRES_BV_2026, 2, 311)
    expect(a).toMatchObject({ depassement: false, assiette: 96.16 })
  })

  it("passe à 70 % du brut au-delà du plafond de 320 € par JEH", () => {
    expect(assietteCotisations(PARAMETRES_BV_2026, 1, 320)).toMatchObject({ depassement: false, assiette: 48.08 })
    expect(assietteCotisations(PARAMETRES_BV_2026, 1, 400)).toMatchObject({ depassement: true, assiette: 280 })
    // Plafond et pourcentage modifiés dans les paramètres.
    const p = { ...PARAMETRES_BV_2026, jeh_plafond_intervenant_brut: "450", bv_assiette_depassement_pct: "60" }
    expect(assietteCotisations(p, 1, 400)).toMatchObject({ depassement: false, assiette: 48.08 })
    expect(assietteCotisations(p, 1, 500)).toMatchObject({ depassement: true, assiette: 300 })
  })

  it("remplit le BV d'une mission 2620 (2 JEH, 311 €) avec les taux 2026, tout sur l'assiette", () => {
    const bv = contexteCotisationsBv(PARAMETRES_BV_2026, 2, 311)
    expect(bv.base_urssaf).toBe("48,08")
    expect(bv.assiette).toBe("96,16")
    expect(bv.retribution_par_jeh).toBe("155,50")
    // Part Junior : maladie 13 %, vieillesse 8,55 % + 2,11 %, famille 5,25 %.
    expect([bv.am_junior_montant, bv.avp_junior_montant, bv.avd_junior_montant, bv.af_junior_montant]).toEqual([
      "12,50", "8,22", "2,03", "5,05",
    ])
    expect(bv.total_junior).toBe("27,80")
    // Part étudiant : vieillesse 6,90 % + 0,40 %, CSG 6,80 %, CSG/CRDS 2,90 % — CSG sur l'assiette, pas sur le brut.
    expect(bv.csg_base).toBe("96,16")
    expect([bv.avp_etudiant_montant, bv.avd_etudiant_montant, bv.csg_etudiant_montant, bv.crdscsg_etudiant_montant]).toEqual([
      "6,64", "0,38", "6,54", "2,79",
    ])
    expect(bv.total_etudiant_taux_urssaf).toBe("7,30")
    expect(bv.total_etudiant).toBe("16,35")
    expect(bv.total_cotisations).toBe("44,15")
    expect(bv.net_paye).toBe("294,65")
    expect(bv.net_imposable).toBe("297,44")
    // Taux à 0 : ligne vide (accident du travail tant que le taux de la Junior n'est pas saisi).
    expect(bv.at_junior_montant).toBe("")
    expect(bv.am_etudiant_taux).toBe("")
  })

  it("affiche la règle des 70 % sur un BV au-delà du plafond", () => {
    const bv = contexteCotisationsBv(PARAMETRES_BV_2026, 1, 400)
    expect(bv.assiette_mode).toBe("reelle")
    expect(bv.base_urssaf).toBe("70 % du brut")
    expect(bv.assiette).toBe("280,00")
    expect(bv.am_junior_montant).toBe("36,40")
  })

  it("ne retient rien tant que les taux ne sont pas renseignés", () => {
    const bv = contexteCotisationsBv({}, 2, 311)
    expect(bv.assiette).toBe("0,00")
    expect(bv.total_cotisations).toBe("0,00")
    expect(bv.net_paye).toBe("311,00")
  })
})
