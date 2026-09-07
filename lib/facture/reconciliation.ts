/**
 * Réconciliation des factures d'une même étude.
 *
 * Les factures générées à la signature (acompte, PVRI éventuel, solde) se
 * partagent le Total HT de l'étude : le dernier versement absorbe l'écart
 * d'arrondi, donc leur somme retombe exactement sur ce total. Chaque facture
 * n'imprime ensuite que sa part, et la facture de solde déduit ce qui a déjà
 * été facturé avant elle — c'est ce calcul de « déjà facturé » qui garantit
 * que les factures se recollent au budget.
 */

export type FactureReconciliable = {
  montant_ht: number | string | null
  date_emission: string | null
  numero_dans_etude?: number | string | null
}

/**
 * Rang d'une facture dans l'étude : (date d'émission, puis rang de création).
 * Une facture non encore émise est classée après toutes les factures émises —
 * elle ne doit jamais être comptée comme « déjà facturée ».
 */
function rang(f: FactureReconciliable): [number, number] {
  return [
    f.date_emission ? new Date(f.date_emission).getTime() : Number.POSITIVE_INFINITY,
    Number(f.numero_dans_etude) || 0,
  ]
}

function precede(a: [number, number], b: [number, number]): boolean {
  return a[0] !== b[0] ? a[0] < b[0] : a[1] < b[1]
}

/**
 * Somme HT des factures de l'étude qui précèdent `courante`.
 * `autres` ne doit PAS contenir `courante`.
 */
export function totalDejaFacture(
  courante: FactureReconciliable,
  autres: FactureReconciliable[]
): number {
  const r = rang(courante)
  const somme = (autres ?? []).reduce(
    (acc, f) => (precede(rang(f), r) ? acc + (Number(f.montant_ht) || 0) : acc),
    0
  )
  return Math.round(somme * 100) / 100
}

/**
 * Répartit un total HT sur des pourcentages de versement. Le dernier absorbe
 * l'écart d'arrondi : la somme des montants égale toujours `totalHt` au
 * centime près. C'est la règle utilisée à la signature d'une propale pour
 * créer les factures d'acompte / intermédiaires / de solde.
 */
export function repartirVersements(totalHt: number, pourcentages: number[]): number[] {
  const dernier = pourcentages.length - 1
  let cumul = 0
  return pourcentages.map((pct, i) => {
    const montant =
      i === dernier
        ? Math.round((totalHt - cumul) * 100) / 100
        : Math.round(totalHt * (Number(pct) / 100) * 100) / 100
    cumul = Math.round((cumul + montant) * 100) / 100
    return montant
  })
}
