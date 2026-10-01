import { describe, it, expect, vi, beforeAll } from "vitest"

vi.mock("server-only", () => ({}))

import { encryptData, generateEncryptionSalt } from "../crypto"
import { lirePII } from "./personne"
import { reprendrePII } from "./reprise"

beforeAll(() => {
  process.env.ENCRYPTION_MASTER_KEY = "cle-de-test-suffisamment-longue"
  vi.spyOn(console, "error").mockImplementation(() => {})
})

/** Base `personnes` en mémoire, juste ce que reprendrePII appelle. */
function fausseBase(lignes: Record<string, any>[]) {
  const table = lignes.map((l) => ({ ...l }))
  const admin = {
    from: () => ({
      select: () => ({
        order: () => ({
          range: async (de: number, a: number) => ({ data: table.slice(de, a + 1).map((l) => ({ ...l })), error: null }),
        }),
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: async (_col: string, id: string) => {
          Object.assign(table.find((l) => l.id === id)!, patch)
          return { error: null }
        },
      }),
    }),
  }
  return { admin: admin as any, table }
}

const importeBeQuick = () => ({
  id: "bq", adresse: "1 rue des Lilas", ville: "Nantes", code_postal: "44000", date_naissance: "2003-05-14",
})
const candidat = () => ({ id: "cand", date_of_birth: "2004-01-02" })

describe("reprendrePII", () => {
  it("sans ecrire, compte sans rien modifier", async () => {
    const { admin, table } = fausseBase([importeBeQuick(), candidat()])
    const bilan = await reprendrePII(admin, { mode: "chiffrer" })
    expect(bilan).toMatchObject({ aTraiter: 2, traites: 0, valeursAChiffrer: 4, dateOfBirthRepris: 1 })
    expect(table[0].adresse_encrypted).toBeUndefined()
  })

  it("chiffrer : écrit la version chiffrée et garde le clair ; vider : l'efface", async () => {
    const { admin, table } = fausseBase([importeBeQuick(), candidat()])

    const b1 = await reprendrePII(admin, { mode: "chiffrer", ecrire: true })
    expect(b1).toMatchObject({ traites: 2, restants: 0 })
    expect(table[0].adresse).toBe("1 rue des Lilas")
    expect(lirePII({ ...table[0], adresse: null, ville: null, code_postal: null, date_naissance: null })).toEqual({
      adresse: "1 rue des Lilas", ville: "Nantes", code_postal: "44000", date_naissance: "2003-05-14",
    })
    // Date de l'inscription candidat reprise dans la date de naissance chiffrée.
    expect(lirePII(table[1]).date_naissance).toBe("2004-01-02")

    const b2 = await reprendrePII(admin, { mode: "vider", ecrire: true })
    expect(b2).toMatchObject({ traites: 2, clairDivergent: 0 })
    expect(table[0]).toMatchObject({ adresse: null, ville: null, code_postal: null, date_naissance: null })
    expect(table[1].date_of_birth).toBeNull()
    expect(lirePII(table[0]).adresse).toBe("1 rue des Lilas")

    // Relancer ne fait plus rien.
    expect((await reprendrePII(admin, { mode: "chiffrer", ecrire: true })).aTraiter).toBe(0)
  })

  it("vider garde une copie en clair qui diffère de la version chiffrée", async () => {
    const sel = generateEncryptionSalt()
    const enc = encryptData("Nantes", process.env.ENCRYPTION_MASTER_KEY!, sel)
    const { admin, table } = fausseBase([
      { id: "p", encryption_salt: sel, ville: "Rezé", ville_encrypted: enc.encrypted, ville_iv: enc.iv, ville_auth_tag: enc.authTag },
    ])
    const bilan = await reprendrePII(admin, { mode: "vider", ecrire: true })
    expect(bilan).toMatchObject({ traites: 0, clairDivergent: 1 })
    expect(table[0].ville).toBe("Rezé")
  })

  it("respecte la limite par appel", async () => {
    const { admin } = fausseBase([importeBeQuick(), { ...importeBeQuick(), id: "bq2" }, candidat()])
    const bilan = await reprendrePII(admin, { mode: "chiffrer", ecrire: true, limite: 2 })
    expect(bilan).toMatchObject({ aTraiter: 3, traites: 2, restants: 1 })
  })

  it("n'écrit rien si la clé en place ne relit pas une valeur déjà chiffrée", async () => {
    const sel = generateEncryptionSalt()
    const enc = encryptData("Nantes", "une-autre-cle-maitre-de-prod", sel)
    const { admin, table } = fausseBase([
      importeBeQuick(),
      { id: "prod", encryption_salt: sel, ville_encrypted: enc.encrypted, ville_iv: enc.iv, ville_auth_tag: enc.authTag },
    ])
    await expect(reprendrePII(admin, { mode: "chiffrer", ecrire: true })).rejects.toThrow(/clé de production/)
    expect(table[0].adresse_encrypted).toBeUndefined()
  })
})
