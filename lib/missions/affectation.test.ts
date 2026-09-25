import { describe, it, expect } from "vitest"
import { motifRefusAffectation, missionComplete, estAffectationDirecte } from "./affectation"

const valide = { account_status: "validated" }

describe("missionComplete", () => {
  it("complète quand le nombre d'acceptés atteint le nombre d'intervenants", () => {
    expect(missionComplete(26, 26)).toBe(true)
    expect(missionComplete(25, 26)).toBe(false)
  })

  it("une mission sans nombre d'intervenants en compte un", () => {
    expect(missionComplete(0, null)).toBe(false)
    expect(missionComplete(1, null)).toBe(true)
  })
})

describe("motifRefusAffectation", () => {
  const base = { personne: valide, dejaSurMission: false, accepteesCount: 0, nbIntervenants: 26 }

  it("autorise un compte validé sur une mission non complète", () => {
    expect(motifRefusAffectation(base)).toBeNull()
  })

  it("refuse une personne introuvable", () => {
    expect(motifRefusAffectation({ ...base, personne: null })).toMatch(/introuvable/)
  })

  it("refuse un compte non validé (candidat en attente, refusé…)", () => {
    expect(
      motifRefusAffectation({ ...base, personne: { account_status: "pending_validation" } })
    ).toMatch(/validé/)
  })

  it("refuse une personne déjà positionnée sur la mission", () => {
    expect(motifRefusAffectation({ ...base, dejaSurMission: true })).toMatch(/déjà/)
  })

  it("refuse quand la mission est complète", () => {
    expect(motifRefusAffectation({ ...base, accepteesCount: 26 })).toMatch(/complète/)
  })
})

describe("estAffectationDirecte", () => {
  it("vrai quand la candidature a été créée par quelqu'un d'autre que l'intervenant", () => {
    expect(estAffectationDirecte({ personne_id: "u1", created_by: "admin" })).toBe(true)
  })

  it("faux pour une candidature déposée par l'intervenant lui-même", () => {
    expect(estAffectationDirecte({ personne_id: "u1", created_by: null })).toBe(false)
    expect(estAffectationDirecte({ personne_id: "u1", created_by: "u1" })).toBe(false)
  })
})
