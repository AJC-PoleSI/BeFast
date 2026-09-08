/**
 * Rétributions intervenants — logique pure (aucun accès base).
 *
 * Une « rétribution » est le versement dû à UNE personne pour UNE mission.
 * La table `retributions` ne stocke que les lignes déjà traitées (BV émis ou
 * paiement enregistré) : les lignes affichées sont recomposées ici à partir des
 * missions, des intervenants sélectionnés et des lignes déjà écrites.
 */

/** Arrondi au centime, pour ne pas traîner de flottants dans les totaux. */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Prochain numéro de BV libre pour l'année : `BV-<année>-<séquence>`.
 * Les numéros hors format (saisis à la main) sont ignorés, jamais écrasés.
 */
export function nextNumeroBV(
  numerosExistants: (string | null | undefined)[],
  annee: number
): string {
  const re = /^BV-(\d{4})-(\d+)$/
  let max = 0
  for (const numero of numerosExistants) {
    const match = re.exec((numero ?? "").trim())
    if (!match) continue
    if (Number(match[1]) !== annee) continue
    max = Math.max(max, Number(match[2]))
  }
  return `BV-${annee}-${String(max + 1).padStart(3, "0")}`
}
