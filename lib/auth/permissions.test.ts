import { describe, it, expect } from "vitest"
import { resolveEffectivePermissions, hasPermission, canEditEtude } from "./permissions"
import type { PersonneWithRole } from "@/types/database.types"

function make(basePerms: any, postes: any[] = [], slug = "membre_ajc"): PersonneWithRole {
  return {
    id: "u1", email: "x@a.com", prenom: null, nom: null, portable: null, promo: null,
    adresse: null, ville: null, code_postal: null, pole: null, etablissement: null,
    scolarite: null, date_naissance: null, nss_encrypted: null, iban_encrypted: null,
    encryption_key_version: 1, profil_type_id: "r1", avatar_url: null, actif: true,
    account_status: "validated", rejection_reason: null, rejected_at: null, rejected_by: null,
    created_at: "", updated_at: "",
    profils_types: basePerms
      ? { id: "r1", nom: "Base", slug, permissions: basePerms, est_defaut: true, categorie: "base", created_at: "", updated_at: "" }
      : null,
    personne_postes: postes,
  } as PersonneWithRole
}

describe("resolveEffectivePermissions", () => {
  it("fait l'union du rôle de base et des postes", () => {
    const p = make({ dashboard: true }, [
      { profils_types: { permissions: { signer_ba: true } } },
      { profils_types: { permissions: { assigner_intervenants: true } } },
    ])
    const e = resolveEffectivePermissions(p)
    expect(e.dashboard).toBe(true)
    expect(e.signer_ba).toBe(true)
    expect(e.assigner_intervenants).toBe(true)
    expect(e.voir_factures).toBe(false)
  })

  it("renvoie tout à false pour un profil null", () => {
    expect(resolveEffectivePermissions(null).dashboard).toBe(false)
  })

  it("ignore un poste sans profils_types", () => {
    const p = make({ profil: true }, [{ profils_types: null }])
    expect(resolveEffectivePermissions(p).profil).toBe(true)
  })
})

describe("hasPermission", () => {
  it("l'administrateur a toutes les permissions", () => {
    const p = make({}, [], "administrateur")
    expect(hasPermission(p, "voir_factures")).toBe(true)
  })
  it("un membre sans poste n'a pas signer_ba", () => {
    expect(hasPermission(make({ dashboard: true }), "signer_ba")).toBe(false)
  })
})

describe("canEditEtude", () => {
  it("l'administrateur peut modifier n'importe quelle étude", () => {
    const p = make({}, [], "administrateur")
    expect(canEditEtude(p, { created_by: "autre-id" })).toBe(true)
  })

  it("le créateur peut modifier son étude même sans permission ni poste", () => {
    const p = make({})
    expect(canEditEtude(p, { created_by: "u1" })).toBe(true)
  })

  it("un poste avec modifier_etudes (ex. Pôle SI) peut modifier une étude qu'il n'a pas créée", () => {
    const p = make({}, [{ profils_types: { permissions: { modifier_etudes: true } } }])
    expect(canEditEtude(p, { created_by: "autre-id" })).toBe(true)
  })

  it("un membre sans permission ni créateur ne peut pas modifier une étude", () => {
    const p = make({ dashboard: true })
    expect(canEditEtude(p, { created_by: "autre-id" })).toBe(false)
  })

  it("un profil null ne peut rien modifier", () => {
    expect(canEditEtude(null, { created_by: "u1" })).toBe(false)
  })
})
