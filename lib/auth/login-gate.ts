/**
 * Décision de connexion. Deux indicateurs disent si l'email est vérifié :
 *  - `auth.users.email_confirmed_at`, contrôlé par Supabase à la connexion ;
 *  - `personnes.email_verified`, contrôlé par l'application juste après.
 *
 * Avant le 02/10/2026, chaque lien n'en mettait à jour qu'un seul (lien natif
 * Supabase → auth.users ; lien Be Fast `/verify-email` → personnes), et la
 * connexion exigeait les deux : cliquer le « mauvais » lien bloquait le compte
 * (« email pas encore vérifié », ou pire « Identifiants incorrects »).
 *
 * Règle : l'un OU l'autre prouve la possession de la boîte mail. On resynchronise
 * l'indicateur manquant au lieu de bloquer.
 */
export type LoginDecision =
  /** Connexion acceptée. `healAppFlag` : passer `personnes.email_verified` à true. */
  | { kind: "ok"; healAppFlag: boolean }
  /** Supabase refuse un email non confirmé alors que l'app l'a vérifié :
   *  confirmer l'email côté Supabase, puis retenter la connexion. */
  | { kind: "confirm_auth_and_retry" }
  | { kind: "needs_verification" }
  | { kind: "bad_credentials" }
  | { kind: "rate_limited" }
  | { kind: "error" }

export function decideLogin(input: {
  /** `error.code` de signInWithPassword, null si la connexion a réussi. */
  authErrorCode: string | null
  /** Succès uniquement : `user.email_confirmed_at` renseigné. */
  authEmailConfirmed: boolean
  /** `personnes.email_verified`, null si aucune ligne. */
  appEmailVerified: boolean | null
}): LoginDecision {
  const { authErrorCode, authEmailConfirmed, appEmailVerified } = input

  if (authErrorCode === null) {
    if (appEmailVerified === false) {
      return authEmailConfirmed
        ? { kind: "ok", healAppFlag: true }
        : { kind: "needs_verification" }
    }
    return { kind: "ok", healAppFlag: false }
  }

  switch (authErrorCode) {
    case "email_not_confirmed":
      return appEmailVerified === true
        ? { kind: "confirm_auth_and_retry" }
        : { kind: "needs_verification" }
    case "invalid_credentials":
      return { kind: "bad_credentials" }
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return { kind: "rate_limited" }
    default:
      return { kind: "error" }
  }
}
