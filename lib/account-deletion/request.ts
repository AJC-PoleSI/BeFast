/**
 * Demande de suppression de compte émise par l'utilisateur lui-même.
 *
 * La demande ne supprime rien : elle laisse une trace dans `support_tickets`
 * et notifie l'administration, qui exécute la suppression depuis BeFast.
 */

/** Une demande par personne et par 24 h ; au-delà, l'utilisateur peut relancer. */
export const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000

/** Valeur écrite dans `support_tickets.type_probleme`. */
export const DELETION_TICKET_TYPE = "suppression_compte"

/**
 * Vrai si une demande précédente est trop récente pour en accepter une autre.
 * Une date absente ou illisible ne bloque jamais l'utilisateur : mieux vaut un
 * email en double qu'une demande de suppression avalée en silence.
 */
export function isDuplicateRequest(
  lastCreatedAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!lastCreatedAt) return false
  const previous = new Date(lastCreatedAt).getTime()
  if (Number.isNaN(previous)) return false
  return now.getTime() - previous < DUPLICATE_WINDOW_MS
}
