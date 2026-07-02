import { describe, it, expect } from "vitest"
import {
  normalizeEmail,
  mapPoste,
  mapStatus,
  mapRow,
  dedupeByEmail,
  type RawRow,
} from "./bequick-mapping"

function raw(over: Partial<RawRow> = {}): RawRow {
  return {
    id: "1", image_url: "", civilite: "", etat_id: "", etat_nom: "Membres",
    email: "a.b@audencia.com", prenom: "A", nom: "B", adresse: "", ville: "",
    code_postal: "", num_secu: "", portable: "", promo: "", poste_id: "",
    poste_intitule: "Intervenant (BA)", admin_validated: "1", competences: "",
    business_units: "", ...over,
  }
}

describe("normalizeEmail", () => {
  it("trims + lowercases", () => {
    expect(normalizeEmail("  Foo.Bar@Audencia.com ")).toBe("foo.bar@audencia.com")
  })
  it("flags a domain without a dot as malformed", () => {
    expect(normalizeEmail("x@audencialcom")).toBeNull()
  })
  it("flags an address without @ as malformed", () => {
    expect(normalizeEmail("notanemail")).toBeNull()
  })
})

describe("mapPoste", () => {
  it("Intervenant (BA) -> intervenant, no poste", () => {
    expect(mapPoste("Intervenant (BA)")).toEqual({ role: "intervenant", postes: [], unknown: false })
  })
  it("Chef de Projet -> membre_ajc", () => {
    expect(mapPoste("Chef de Projet")).toEqual({ role: "membre_ajc", postes: [], unknown: false })
  })
  it("1A (mandat entrant) -> membre_ajc", () => {
    expect(mapPoste("1A (mandat entrant)")).toEqual({ role: "membre_ajc", postes: [], unknown: false })
  })
  it("Pôle RH -> membre_ajc + pole_rh", () => {
    expect(mapPoste("Pôle RH")).toEqual({ role: "membre_ajc", postes: ["pole_rh"], unknown: false })
  })
  it("Pôle Trésorerie -> membre_ajc + tresorier", () => {
    expect(mapPoste("Pôle Trésorerie")).toEqual({ role: "membre_ajc", postes: ["tresorier"], unknown: false })
  })
  it("Administrateur -> administrateur", () => {
    expect(mapPoste("Administrateur")).toEqual({ role: "administrateur", postes: [], unknown: false })
  })
  it("empty -> intervenant (default)", () => {
    expect(mapPoste("")).toEqual({ role: "intervenant", postes: [], unknown: false })
  })
  it("unknown non-empty -> intervenant but flagged unknown", () => {
    expect(mapPoste("Grand Manitou")).toEqual({ role: "intervenant", postes: [], unknown: true })
  })
})

describe("mapStatus", () => {
  it("Radié -> inactif, pending", () => {
    expect(mapStatus("Radié", "1")).toEqual({ accountStatus: "pending_validation", actif: false })
  })
  it("Candidats -> actif, pending", () => {
    expect(mapStatus("Candidats", "1")).toEqual({ accountStatus: "pending_validation", actif: true })
  })
  it("Membres validated=1 -> validated", () => {
    expect(mapStatus("Membres", "1")).toEqual({ accountStatus: "validated", actif: true })
  })
  it("Membres validated=0 -> pending", () => {
    expect(mapStatus("Membres", "0")).toEqual({ accountStatus: "pending_validation", actif: true })
  })
})

describe("mapRow", () => {
  it("produces a valid member for a normal row", () => {
    const r = mapRow(raw({ id: "42", num_secu: "199", adresse: "1 rue X" }))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.member.legacyId).toBe(42)
      expect(r.member.email).toBe("a.b@audencia.com")
      expect(r.member.roleSlug).toBe("intervenant")
      expect(r.member.nss).toBe("199")
      expect(r.member.adresse).toBe("1 rue X")
    }
  })
  it("returns an anomaly for a malformed email", () => {
    const r = mapRow(raw({ email: "x@audencialcom" }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe("email_malformed")
  })
})

describe("dedupeByEmail", () => {
  it("keeps first occurrence and counts duplicates", () => {
    const rows = [raw({ id: "1" }), raw({ id: "2" }), raw({ id: "3", email: "c@audencia.com" })]
    const members = rows.map(mapRow).flatMap((r) => (r.ok ? [r.member] : []))
    const { unique, duplicates } = dedupeByEmail(members)
    expect(unique).toHaveLength(2)
    expect(duplicates).toHaveLength(1)
    expect(duplicates[0].legacyId).toBe(2)
  })
})
