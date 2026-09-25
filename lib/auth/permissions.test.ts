import { describe, it, expect } from "vitest"
import {
  resolveEffectivePermissions,
  hasPermission,
  canEditEtude,
  canDeleteEtude,
} from "./permissions"
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

  it("l'administrateur a toutes les permissions même si le rôle en base ne les liste pas", () => {
    const p = make({}, [], "administrateur")
    const e = resolveEffectivePermissions(p)
    expect(e.membres).toBe(true)
    expect(e.voir_factures).toBe(true)
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

  it("le suiveur (chef de projet) peut modifier l'étude qu'il suit", () => {
    const p = make({ dashboard: true })
    expect(
      canEditEtude(p, { created_by: "autre-id", suiveurs: [{ id: "u1" }] })
    ).toBe(true)
  })

  it("un membre qui n'est pas suiveur de l'étude ne peut pas la modifier", () => {
    const p = make({ dashboard: true })
    expect(
      canEditEtude(p, { created_by: "autre-id", suiveurs: [{ id: "autre-id" }] })
    ).toBe(false)
  })

  it("une liste de suiveurs absente ne donne aucun droit supplémentaire", () => {
    const p = make({ dashboard: true })
    expect(canEditEtude(p, { created_by: "autre-id" })).toBe(false)
  })
})

describe("canDeleteEtude", () => {
  it("le suiveur ne peut PAS supprimer l'étude qu'il suit (cf. migration 056)", () => {
    const p = make({ dashboard: true })
    expect(
      canDeleteEtude(p, { created_by: "autre-id", suiveurs: [{ id: "u1" }] })
    ).toBe(false)
  })

  it("le créateur peut supprimer son étude", () => {
    const p = make({ dashboard: true })
    expect(canDeleteEtude(p, { created_by: "u1" })).toBe(true)
  })

  it("un poste avec modifier_etudes peut supprimer une étude qu'il n'a pas créée", () => {
    const p = make({}, [{ profils_types: { permissions: { modifier_etudes: true } } }])
    expect(canDeleteEtude(p, { created_by: "autre-id" })).toBe(true)
  })

  it("l'administrateur peut supprimer n'importe quelle étude", () => {
    const p = make({}, [], "administrateur")
    expect(canDeleteEtude(p, { created_by: "autre-id" })).toBe(true)
  })
})
