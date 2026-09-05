import { describe, it, expect } from "vitest"
import {
  buildAnonymisationPatch,
  anonymisedEmailFor,
  DELETED_STATUS,
} from "./purge"

const ID = "11111111-2222-3333-4444-555555555555"

describe("anonymisedEmailFor", () => {
  it("dérive une adresse unique de l'identifiant", () => {
    expect(anonymisedEmailFor(ID)).toBe(`supprime+${ID}@ajc-mail.com`)
  })

  it("donne des adresses différentes à deux personnes", () => {
    expect(anonymisedEmailFor("a")).not.toBe(anonymisedEmailFor("b"))
  })
})

describe("buildAnonymisationPatch", () => {
  const patch = buildAnonymisationPatch(ID)

  it("coupe l'accès", () => {
    expect(patch.account_status).toBe(DELETED_STATUS)
  })

  it("remplace l'identité", () => {
    expect(patch.prenom).toBe("Compte")
    expect(patch.nom).toBe("supprimé")
    expect(patch.email).toBe(anonymisedEmailFor(ID))
  })

  it("vide les six familles de colonnes chiffrées et leurs métadonnées", () => {
    for (const champ of [
      "nss",
      "iban",
      "adresse",
      "date_naissance",
      "ville",
      "code_postal",
    ]) {
      expect(patch[`${champ}_encrypted`]).toBeNull()
      expect(patch[`${champ}_iv`]).toBeNull()
      expect(patch[`${champ}_auth_tag`]).toBeNull()
    }
    expect(patch.encryption_salt).toBeNull()
  })

  it("vide les colonnes personnelles en clair", () => {
    for (const champ of [
      "portable",
      "avatar_url",
      "adresse",
      "ville",
      "code_postal",
      "date_naissance",
    ]) {
      expect(patch[champ]).toBeNull()
    }
  })

  it("invalide un lien de réinitialisation de mot de passe encore en vol", () => {
    // Un token émis avant la suppression reste valable 72 h : le laisser en base
    // rendrait la main sur un compte censé être neutralisé.
    expect(patch.reset_token_hash).toBeNull()
    expect(patch.reset_token_expires_at).toBeNull()
  })

  it("ne touche ni au rôle ni au profil type", () => {
    expect(patch).not.toHaveProperty("profil_type_id")
    expect(patch).not.toHaveProperty("pole")
  })
})
