import { describe, it, expect } from "vitest"
import {
  normalizeEmail,
  mapPoste,
  mapStatus,
  mapRow,
  dedupeByEmail,
  buildPersonnePatch,
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

describe("buildPersonnePatch", () => {
  it("écrit les colonnes plaintext existantes + nss chiffré, PAS les colonnes migration 022", () => {
    const r = mapRow(
      raw({
        id: "5",
        adresse: "1 rue X",
        ville: "Nantes",
        code_postal: "44000",
        portable: "0600",
        promo: "2029",
        num_secu: "199",
        poste_intitule: "Chef de Projet",
        admin_validated: "1",
      })
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const patch = buildPersonnePatch(r.member, "role-123", (s) => `ENC(${s})`)

    // Colonnes plaintext réellement présentes en base + affichées par l'app.
    expect(patch.adresse).toBe("1 rue X")
    expect(patch.ville).toBe("Nantes")
    expect(patch.code_postal).toBe("44000")
    expect(patch.portable).toBe("0600")
    expect(patch.promo).toBe("2029")
    expect(patch.profil_type_id).toBe("role-123")
    expect(patch.account_status).toBe("validated")
    expect(patch.legacy_bequick_id).toBe(5)
    // NSS via le schéma actif (encryptToString) → colonne nss_encrypted.
    expect(patch.nss_encrypted).toBe("ENC(199)")

    // AUCUNE colonne de la migration 022 (absente de cette base).
    for (const bad of [
      "adresse_encrypted", "adresse_iv", "adresse_auth_tag",
      "ville_encrypted", "code_postal_encrypted",
      "nss_iv", "nss_auth_tag", "encryption_salt",
    ]) {
      expect(bad in patch).toBe(false)
    }
  })

  it("n'inclut pas nss_encrypted quand le NSS est absent", () => {
    const r = mapRow(raw({ num_secu: "" }))
    if (!r.ok) throw new Error("mapRow should succeed")
    const patch = buildPersonnePatch(r.member, null, (s) => `ENC(${s})`)
    expect("nss_encrypted" in patch).toBe(false)
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
