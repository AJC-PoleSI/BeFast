import { describe, it, expect } from "vitest"
import {
  FOURCHETTE_JEH_DEFAUT,
  PARAMETRE_PLAFOND_JEH_CLIENT,
  PARAMETRE_PLAFOND_JEH_INTERVENANT,
  PARAMETRE_PRIX_MIN_JEH_CLIENT,
  PARAMETRE_RETRIBUTION_MIN_JEH,
  blocageRetribution,
  depassementsFourchetteJeh,
  lireFourchetteJeh,
  nbJehMinimum,
} from "./fourchette-jeh"
import { coutClientParIntervenant } from "./remuneration"

// Coût client d'un intervenant, marge de l'étude comprise (même règle que la facturation).
const cout = (retribution: number, margePct: number) => coutClientParIntervenant({ remuneration: retribution }, margePct)

describe("fourchette du JEH (plafonds CNJE)", () => {
  it("retient la fourchette CNJE 2026 et la base URSSAF 2026 par défaut", () => {
    expect(FOURCHETTE_JEH_DEFAUT).toEqual({
      prixMinClientHt: 80,
      plafondClientHt: 500,
      plafondIntervenantBrut: 320,
      retributionMinBrut: 48.08,
    })
    expect(lireFourchetteJeh(undefined)).toEqual(FOURCHETTE_JEH_DEFAUT)
    expect(lireFourchetteJeh({ [PARAMETRE_PLAFOND_JEH_CLIENT]: "", [PARAMETRE_PLAFOND_JEH_INTERVENANT]: "0" })).toEqual(
      FOURCHETTE_JEH_DEFAUT
    )
    expect(lireFourchetteJeh({ [PARAMETRE_PLAFOND_JEH_CLIENT]: "abc" })).toEqual(FOURCHETTE_JEH_DEFAUT)
  })

  it("suit les plafonds édités dans les paramètres", () => {
    expect(
      lireFourchetteJeh({
        [PARAMETRE_PRIX_MIN_JEH_CLIENT]: "90",
        [PARAMETRE_PLAFOND_JEH_CLIENT]: "550",
        [PARAMETRE_PLAFOND_JEH_INTERVENANT]: "335.5",
        [PARAMETRE_RETRIBUTION_MIN_JEH]: "60",
      })
    ).toEqual({ prixMinClientHt: 90, plafondClientHt: 550, plafondIntervenantBrut: 335.5, retributionMinBrut: 60 })
    // Minimum à 0 : aucun blocage ; vide : défaut.
    expect(lireFourchetteJeh({ [PARAMETRE_RETRIBUTION_MIN_JEH]: "0" }).retributionMinBrut).toBe(0)
    expect(lireFourchetteJeh({ [PARAMETRE_RETRIBUTION_MIN_JEH]: "" }).retributionMinBrut).toBe(48.08)
  })

  it("propose le plus petit nombre entier de JEH sous les deux plafonds", () => {
    expect(nbJehMinimum(0, 0)).toBe(1)
    expect(nbJehMinimum(150, 250)).toBe(1)
    // Plafonds atteints pile : toujours 1 JEH (le plafond est un maximum).
    expect(nbJehMinimum(320, 500)).toBe(1)
    // Côté client : 1 001 € HT ne tient pas en 2 JEH à 500 €.
    expect(nbJehMinimum(200, 1000)).toBe(2)
    expect(nbJehMinimum(200, 1001)).toBe(3)
    // Côté intervenant : 485 € brut dépasse 320 € pour un seul JEH.
    expect(nbJehMinimum(485, 485)).toBe(2)
    expect(nbJehMinimum(960, 960)).toBe(3)
    // Plafonds modifiés.
    expect(nbJehMinimum(485, 485, { ...FOURCHETTE_JEH_DEFAUT, plafondIntervenantBrut: 500 })).toBe(1)
  })

  it("retrouve les missions réelles, marge comprise", () => {
    // 2618 « Analyse des résultats » : 320 € à 34 % ⇒ 485 € client ⇒ 1 JEH.
    expect(nbJehMinimum(320, cout(320, 34))).toBe(1)
    // 2618 « Suivi de projet » : 600 € à 34 % ⇒ 910 € client ⇒ 2 JEH minimum (3 saisis, conforme).
    expect(nbJehMinimum(600, cout(600, 34))).toBe(2)
    expect(depassementsFourchetteJeh(3, 600, cout(600, 34))).toEqual([])
    // 2620 « Suivi de l'étude » : 901 € à 27 % ⇒ 1 235 € client ⇒ 3 JEH.
    expect(nbJehMinimum(901, cout(901, 27))).toBe(3)
  })

  it("signale les plafonds dépassés", () => {
    expect(depassementsFourchetteJeh(1, 320, 500)).toEqual([])
    expect(depassementsFourchetteJeh(1, 485, 485)).toEqual([{ cote: "intervenant", parJeh: 485, plafond: 320 }])
    expect(depassementsFourchetteJeh(2, 600, 1235)).toEqual([
      { cote: "client", parJeh: 617.5, plafond: 500 },
    ])
    expect(depassementsFourchetteJeh(1, 901, 1235)).toEqual([
      { cote: "client", parJeh: 1235, plafond: 500 },
      { cote: "intervenant", parJeh: 901, plafond: 320 },
    ])
    // Rien à contrôler tant que le nombre de JEH n'est pas saisi.
    expect(depassementsFourchetteJeh(0, 901, 1235)).toEqual([])
  })

  it("bloque une mission sous l'un des deux minimums par JEH", () => {
    // Mission non rétribuée : rien à bloquer.
    expect(blocageRetribution(0, 0, 0)).toBeNull()
    expect(blocageRetribution(2, 0, 0)).toBeNull()
    // Rétribuée sans JEH : impossible.
    expect(blocageRetribution(0, 150, 200)).toMatch(/au moins 1 JEH/)
    // 2620 : 311 € pour 2 JEH à 27 % ⇒ 426 € client, 213 € HT et 155,50 € brut par JEH.
    expect(blocageRetribution(2, 311, cout(311, 27))).toBeNull()
    // Pile aux minimums : accepté.
    expect(blocageRetribution(1, 80, 80)).toBeNull()
    expect(blocageRetribution(1, 48.08, 80)).toBeNull()
    // Client : un JEH à 50 € HT est hors fourchette CNJE.
    expect(blocageRetribution(1, 50, 50)).toMatch(/^50\s€ HT facturé par JEH, c'est sous le minimum CNJE de 80\s€ HT/)
    // 60 € pour 2 JEH à 34 % ⇒ 91 € client ⇒ 45,50 € HT par JEH.
    expect(blocageRetribution(2, 60, cout(60, 34))).toMatch(/sous le minimum CNJE/)
    // Intervenant : 45 € brut par JEH, facturés 100 € HT, sous les 48,08 € de la Junior.
    expect(blocageRetribution(1, 45, 100)).toMatch(/^45\s€ brut reversé par JEH, c'est sous le minimum de 48,08\s€/)
    // Minimums désactivés.
    const sansMinimum = { ...FOURCHETTE_JEH_DEFAUT, prixMinClientHt: 0, retributionMinBrut: 0 }
    expect(blocageRetribution(2, 20, 30, sansMinimum)).toBeNull()
  })
})
