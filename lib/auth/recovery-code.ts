/**
 * Code de réinitialisation saisi à la main (« Mot de passe oublié »).
 *
 * Le lien seul ne suffisait pas : les passerelles antivirus des boîtes
 * Audencia ouvrent les liens avant l'humain, et la page /reset-password
 * consommait le jeton au chargement — le membre trouvait ensuite « lien
 * expiré » (9 refus `otp_expired` en 24 h, 10/10/2026). Un code tapé à la
 * main ne peut pas être grillé par un robot.
 *
 * Supabase génère le code (`email_otp` de generateLink) : 8 chiffres sur ce
 * projet, mais la longueur est réglable (6 à 10) côté Supabase, d'où la
 * tolérance ci-dessous.
 */
export const RECOVERY_CODE_MIN = 6
export const RECOVERY_CODE_MAX = 10

/**
 * Nettoie la saisie (espaces, tirets, points d'un copier-coller) et renvoie
 * le code s'il a une forme plausible, sinon null.
 */
export function normaliserCodeRecuperation(saisie: string): string | null {
  const code = saisie.replace(/[\s.\-]/g, "")
  if (!/^\d+$/.test(code)) return null
  if (code.length < RECOVERY_CODE_MIN || code.length > RECOVERY_CODE_MAX) return null
  return code
}

/** Affichage aéré dans l'email : « 1234 5678 ». */
export function formaterCodeRecuperation(code: string): string {
  return code.length > 4 && code.length % 2 === 0
    ? `${code.slice(0, code.length / 2)} ${code.slice(code.length / 2)}`
    : code
}
