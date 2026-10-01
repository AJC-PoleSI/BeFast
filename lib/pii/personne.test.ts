import { describe, it, expect, vi, beforeAll } from "vitest"

vi.mock("server-only", () => ({}))

import { encryptData, generateEncryptionSalt } from "../crypto"
import { encryptToString } from "../encryption"
import { lirePII, avecPIIEnClair, colonnesPII, COLONNES_PII, lireSecret } from "./personne"

beforeAll(() => {
  process.env.ENCRYPTION_MASTER_KEY = "cle-de-test-suffisamment-longue"
  process.env.ENCRYPTION_KEY = "ab".repeat(32)
})

describe("colonnesPII", () => {
  it("chiffre la valeur et vide toujours la colonne en clair", () => {
    const sel = generateEncryptionSalt()
    const cols = colonnesPII({ adresse: "1 rue des Lilas", ville: undefined }, sel)
    expect(cols.adresse).toBeNull()
    expect(cols.adresse_encrypted).toBeTruthy()
    expect(cols.adresse_encrypted).not.toContain("Lilas")
    // Champ non transmis : rien n'est écrit.
    expect("ville" in cols).toBe(false)
    expect("ville_encrypted" in cols).toBe(false)
  })

  it("efface les deux versions quand le champ est vidé", () => {
    const cols = colonnesPII({ code_postal: "", date_naissance: null }, generateEncryptionSalt())
    expect(cols).toMatchObject({
      code_postal: null, code_postal_encrypted: null, code_postal_iv: null, code_postal_auth_tag: null,
      date_naissance: null, date_naissance_encrypted: null,
    })
  })
})

describe("lirePII", () => {
  it("relit ce que colonnesPII a chiffré", () => {
    const sel = generateEncryptionSalt()
    const row = {
      encryption_salt: sel,
      ...colonnesPII({ adresse: "1 rue des Lilas", ville: "Nantes", code_postal: "44000", date_naissance: "2003-05-14" }, sel),
    }
    expect(lirePII(row)).toEqual({
      adresse: "1 rue des Lilas", ville: "Nantes", code_postal: "44000", date_naissance: "2003-05-14",
    })
  })

  it("la version chiffrée l'emporte sur une copie en clair divergente", () => {
    const sel = generateEncryptionSalt()
    const row = { encryption_salt: sel, ...colonnesPII({ ville: "Nantes" }, sel), ville: "Ancienne ville" }
    expect(lirePII(row).ville).toBe("Nantes")
  })

  it("se replie sur la colonne en clair d'une ligne pas encore chiffrée", () => {
    expect(lirePII({ adresse: "2 rue X", ville: " ", code_postal: null })).toEqual({
      adresse: "2 rue X", ville: null, code_postal: null, date_naissance: null,
    })
  })

  it("ne lève pas sur une valeur indéchiffrable", () => {
    const row = {
      id: "p1",
      encryption_salt: generateEncryptionSalt(),
      adresse_encrypted: "00", adresse_iv: "00", adresse_auth_tag: "00",
    }
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(lirePII(row).adresse).toBeNull()
  })
})

describe("avecPIIEnClair", () => {
  it("expose les valeurs déchiffrées et retire les colonnes de chiffrement", () => {
    const sel = generateEncryptionSalt()
    const row = {
      id: "p1", prenom: "Jean", encryption_salt: sel,
      nss_encrypted: "x", nss_iv: "y", nss_auth_tag: "z",
      ...colonnesPII({ adresse: "1 rue des Lilas" }, sel),
    }
    const sortie = avecPIIEnClair(row)
    expect(sortie).toMatchObject({ id: "p1", prenom: "Jean", adresse: "1 rue des Lilas" })
    for (const k of Object.keys(sortie)) {
      expect(k).not.toMatch(/_encrypted$|_iv$|_auth_tag$|^encryption_salt$/)
    }
  })
})

describe("COLONNES_PII", () => {
  it("liste le sel et les 4 familles de colonnes", () => {
    expect(COLONNES_PII.split(", ")).toHaveLength(1 + 4 * 4)
  })
})

describe("lireSecret", () => {
  it("lit le format mono-chaîne (import Be Quick, /api/profil/sensitive)", () => {
    expect(lireSecret({ nss_encrypted: encryptToString("1 03 05 44 109 123 45") }, "nss")).toBe(
      "1 03 05 44 109 123 45"
    )
  })
  it("lit le format à trois colonnes", () => {
    const sel = generateEncryptionSalt()
    const enc = encryptData("FR7612345", process.env.ENCRYPTION_MASTER_KEY!, sel)
    const row = { encryption_salt: sel, iban_encrypted: enc.encrypted, iban_iv: enc.iv, iban_auth_tag: enc.authTag }
    expect(lireSecret(row, "iban")).toBe("FR7612345")
  })
  it("renvoie null sans lever si absent ou illisible", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(lireSecret({}, "nss")).toBeNull()
    expect(lireSecret({ nss_encrypted: "pas:un:chiffre" }, "nss")).toBeNull()
  })
})
