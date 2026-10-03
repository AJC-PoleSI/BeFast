import { describe, it, expect } from "vitest"
import { decideLogin } from "./login-gate"

describe("decideLogin", () => {
  it("laisse entrer un compte vérifié des deux côtés", () => {
    expect(
      decideLogin({ authErrorCode: null, authEmailConfirmed: true, appEmailVerified: true })
    ).toEqual({ kind: "ok", healAppFlag: false })
  })

  // Cas du 02/10/2026 : lien Supabase cliqué (ou ouvert par l'antivirus
  // Outlook), lien Be Fast jamais cliqué. La boîte mail est prouvée.
  it("répare le drapeau maison quand Supabase a déjà confirmé l'email", () => {
    expect(
      decideLogin({ authErrorCode: null, authEmailConfirmed: true, appEmailVerified: false })
    ).toEqual({ kind: "ok", healAppFlag: true })
  })

  it("exige la vérification si aucun des deux côtés ne l'a prouvée", () => {
    expect(
      decideLogin({ authErrorCode: null, authEmailConfirmed: false, appEmailVerified: false })
    ).toEqual({ kind: "needs_verification" })
  })

  it("laisse entrer un compte sans ligne personnes (comportement historique)", () => {
    expect(
      decideLogin({ authErrorCode: null, authEmailConfirmed: true, appEmailVerified: null })
    ).toEqual({ kind: "ok", healAppFlag: false })
  })

  // Lien Be Fast cliqué, lien Supabase jamais : Supabase refuse la connexion.
  // Avant : « Identifiants incorrects ».
  it("confirme Supabase puis réessaie quand seul le drapeau maison est vrai", () => {
    expect(
      decideLogin({ authErrorCode: "email_not_confirmed", authEmailConfirmed: false, appEmailVerified: true })
    ).toEqual({ kind: "confirm_auth_and_retry" })
  })

  it("demande la vérification quand Supabase refuse un email non confirmé", () => {
    expect(
      decideLogin({ authErrorCode: "email_not_confirmed", authEmailConfirmed: false, appEmailVerified: false })
    ).toEqual({ kind: "needs_verification" })
    expect(
      decideLogin({ authErrorCode: "email_not_confirmed", authEmailConfirmed: false, appEmailVerified: null })
    ).toEqual({ kind: "needs_verification" })
  })

  it("distingue le mauvais mot de passe", () => {
    expect(
      decideLogin({ authErrorCode: "invalid_credentials", authEmailConfirmed: false, appEmailVerified: true })
    ).toEqual({ kind: "bad_credentials" })
  })

  it.each(["over_request_rate_limit", "over_email_send_rate_limit"])(
    "distingue la limite de débit (%s)",
    (code) => {
      expect(
        decideLogin({ authErrorCode: code, authEmailConfirmed: false, appEmailVerified: true })
      ).toEqual({ kind: "rate_limited" })
    }
  )

  it("classe toute autre erreur comme une panne, pas comme un mauvais mot de passe", () => {
    expect(
      decideLogin({ authErrorCode: "unexpected_failure", authEmailConfirmed: false, appEmailVerified: true })
    ).toEqual({ kind: "error" })
  })
})
