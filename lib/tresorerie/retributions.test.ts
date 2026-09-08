import { describe, it, expect } from "vitest"
import { nextNumeroBV } from "./retributions"

describe("nextNumeroBV", () => {
  it("démarre à 001 quand aucun numéro n'existe", () => {
    expect(nextNumeroBV([], 2026)).toBe("BV-2026-001")
  })

  it("incrémente le plus grand numéro de l'année", () => {
    expect(nextNumeroBV(["BV-2026-001", "BV-2026-009", "BV-2026-004"], 2026)).toBe("BV-2026-010")
  })

  it("ignore les numéros des autres années", () => {
    expect(nextNumeroBV(["BV-2025-042"], 2026)).toBe("BV-2026-001")
  })

  it("ignore les numéros libres saisis à la main et les valeurs nulles", () => {
    expect(nextNumeroBV(["virement mars", null, undefined, "BV-2026-002"], 2026)).toBe("BV-2026-003")
  })

  it("passe à 4 chiffres au-delà de 999 sans tronquer", () => {
    expect(nextNumeroBV(["BV-2026-999"], 2026)).toBe("BV-2026-1000")
  })
})
