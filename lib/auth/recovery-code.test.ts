import { describe, it, expect } from "vitest"
import { normaliserCodeRecuperation, formaterCodeRecuperation } from "./recovery-code"

describe("normaliserCodeRecuperation", () => {
  it("accepte un code de 8 chiffres", () => {
    expect(normaliserCodeRecuperation("12345678")).toBe("12345678")
  })

  it("retire espaces, tirets et points d'un copier-coller", () => {
    expect(normaliserCodeRecuperation(" 1234 5678 ")).toBe("12345678")
    expect(normaliserCodeRecuperation("1234-5678")).toBe("12345678")
    expect(normaliserCodeRecuperation("12.34.56")).toBe("123456")
  })

  it("refuse lettres et longueurs hors bornes", () => {
    expect(normaliserCodeRecuperation("12a45678")).toBeNull()
    expect(normaliserCodeRecuperation("12345")).toBeNull()
    expect(normaliserCodeRecuperation("12345678901")).toBeNull()
    expect(normaliserCodeRecuperation("")).toBeNull()
  })
})

describe("formaterCodeRecuperation", () => {
  it("coupe un code pair en deux blocs", () => {
    expect(formaterCodeRecuperation("12345678")).toBe("1234 5678")
    expect(formaterCodeRecuperation("123456")).toBe("123 456")
  })

  it("laisse un code impair intact", () => {
    expect(formaterCodeRecuperation("1234567")).toBe("1234567")
  })
})
