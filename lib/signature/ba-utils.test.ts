import { describe, it, expect } from "vitest"
import {
  toE164FR,
  frDate,
  missingProfileFields,
  buildBaFieldValues,
  type MemberData,
} from "./ba-utils"

const complete: MemberData = {
  id: "u1",
  email: "jean@example.com",
  prenom: "Jean",
  nom: "Dupont",
  portable: "0612345678",
  promo: "2026",
  etablissement: "Audencia Nantes",
  scolarite: "Master 1",
  account_status: "validated",
  adresse: "1 rue des Lilas",
  ville: "Nantes",
  code_postal: "44000",
  date_naissance: "2003-05-14",
}

describe("toE164FR", () => {
  it("convertit un 0… national en +33", () => {
    expect(toE164FR("0612345678")).toBe("+33612345678")
  })
  it("préserve un numéro déjà au format +33", () => {
    expect(toE164FR("+33612345678")).toBe("+33612345678")
  })
  it("préfixe les numéros commençant par 33", () => {
    expect(toE164FR("33612345678")).toBe("+33612345678")
  })
  it("ignore les espaces et séparateurs", () => {
    expect(toE164FR("06 12 34 56 78")).toBe("+33612345678")
  })
  it("renvoie une chaîne vide pour null/vide", () => {
    expect(toE164FR(null)).toBe("")
    expect(toE164FR("")).toBe("")
  })
})

describe("frDate", () => {
  it("formate une date ISO en JJ/MM/AAAA", () => {
    expect(frDate("2003-05-14")).toBe("14/05/2003")
    expect(frDate("2003-05-14T00:00:00.000Z")).toBe("14/05/2003")
  })
  it("renvoie la valeur telle quelle si non ISO", () => {
    expect(frDate("14/05/2003")).toBe("14/05/2003")
  })
  it("renvoie vide pour null", () => {
    expect(frDate(null)).toBe("")
  })
})

describe("missingProfileFields", () => {
  it("ne renvoie rien quand le profil est complet", () => {
    expect(missingProfileFields(complete)).toEqual([])
  })
  it("liste les champs manquants (null ou vides)", () => {
    const m = { ...complete, ville: null, code_postal: "  ", portable: "" }
    expect(missingProfileFields(m)).toEqual(
      expect.arrayContaining(["portable", "ville", "code_postal"])
    )
    expect(missingProfileFields(m)).toHaveLength(3)
  })
})

describe("buildBaFieldValues", () => {
  it("mappe les champs membre vers les 5 champs du template BA-2025", () => {
    const v = buildBaFieldValues(complete)
    expect(v.nom_complet).toBe("Jean Dupont")
    expect(v.portable).toBe("0612345678")
    // E-mail : partie locale seule (le PDF imprime déjà @audencia.com).
    expect(v.email_audencia).toBe("jean")
    expect(v.promo).toBe("2026")
    // Adresse foyer fiscal = adresse + « CP Ville » sur une ligne.
    expect(v.adresse_complete).toBe("1 rue des Lilas, 44000 Nantes")
  })
  it("tolère les valeurs nulles sans planter", () => {
    const v = buildBaFieldValues({ ...complete, prenom: null, adresse: null })
    expect(v.nom_complet).toBe("Dupont")
    // adresse nulle → on ne garde que « CP Ville ».
    expect(v.adresse_complete).toBe("44000 Nantes")
  })
})
