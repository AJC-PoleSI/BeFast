import { describe, it, expect } from "vitest"
import { estMissionPubliee } from "./mission-visibilite"

describe("estMissionPubliee", () => {
  it("ouvre la mission quand elle et son étude sont publiées", () => {
    expect(estMissionPubliee({ published: true, etudes: { published: true } })).toBe(true)
  })

  it("garde cachée une mission non publiée sous une étude publiée", () => {
    expect(estMissionPubliee({ published: false, etudes: { published: true } })).toBe(false)
  })

  it("garde cachée une mission publiée tant que l'étude ne l'est pas", () => {
    expect(estMissionPubliee({ published: true, etudes: { published: false } })).toBe(false)
  })

  it("traite une jointure étude absente (RLS, mission orpheline) comme non publiée", () => {
    expect(estMissionPubliee({ published: true, etudes: null })).toBe(false)
    expect(estMissionPubliee({ published: true })).toBe(false)
  })

  it("traite un flag absent comme non publié", () => {
    expect(estMissionPubliee({ etudes: { published: true } })).toBe(false)
    expect(estMissionPubliee({ published: null, etudes: { published: true } })).toBe(false)
  })
})
