// Source de vérité unique du calcul de budget d'une proposition.
//
// Utilisée partout (récap CDP dans le formulaire, modale de validation
// trésorerie, export Excel, tableau budget de la propal PPTX) pour qu'aucune
// divergence de calcul ne soit possible entre ces vues.
//
// Règle de marge (alignée sur le template Excel Audencia) : la marge est un
// GROSSISSEMENT du SDP (prix de vente), pas une simple majoration :
//   prix_avec_marge = ROUNDUP(base / (1 - marge%/100))
//   marge_€         = prix_avec_marge - base
//   ex. base=100, marge=38% → ceil(100/0,62)=162 → marge=62
// La base inclut le SDP des phases ET le suivi de projet.

export interface BudgetPhaseInput {
  name: string
  jehCount: number
  jehPrice: number
}

export interface BudgetInput {
  phases: BudgetPhaseInput[]
  suiviJehCount: number
  suiviJehPrice: number
  margeJePct: number
  fraisDossier: number
  globalFraisAnnexes: number
  tvaPct?: number // défaut 20
}

export interface BudgetPhaseLine {
  name: string
  jeh: number
  prixJeh: number // « Montant » unitaire par JEH
  montant: number // « TOTAL » de la ligne = jeh × prixJeh
}

export interface BudgetBreakdown {
  phases: BudgetPhaseLine[]
  suiviJeh: number
  suiviPrixJeh: number
  suiviTotal: number
  totalPhasesJeh: number
  margePct: number
  margeJe: number
  fraisStructure: number
  totalJehHt: number // phases + suivi + marge (la marge est « fondue » dans le JEH)
  totalHt: number // totalJehHt + frais de structure
  tvaPct: number
  tva: number
  netAPayer: number // TTC
  acompte60: number // 60 % à la signature
  solde40: number // 40 % au PV de recette
}

const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

export function computeBudget(input: BudgetInput): BudgetBreakdown {
  const tvaPct = input.tvaPct ?? 20

  const phases: BudgetPhaseLine[] = (input.phases ?? []).map((p) => {
    const jeh = Number(p.jehCount || 0)
    const prixJeh = Number(p.jehPrice || 0)
    return { name: p.name, jeh, prixJeh, montant: r2(jeh * prixJeh) }
  })

  const totalPhasesJeh = r2(phases.reduce((s, p) => s + p.montant, 0))

  const suiviJeh = Number(input.suiviJehCount || 0)
  const suiviPrixJeh = Number(input.suiviJehPrice || 0)
  const suiviTotal = r2(suiviJeh * suiviPrixJeh)

  const margePct = Number(input.margeJePct || 0)
  const margeBase = totalPhasesJeh + suiviTotal
  const margeJe =
    margePct > 0 ? r2(Math.ceil(margeBase / (1 - margePct / 100)) - margeBase) : 0

  const fraisStructure = r2(
    Number(input.fraisDossier || 0) + Number(input.globalFraisAnnexes || 0)
  )

  const totalJehHt = r2(totalPhasesJeh + suiviTotal + margeJe)
  const totalHt = r2(totalJehHt + fraisStructure)
  const tva = r2(totalHt * (tvaPct / 100))
  const netAPayer = r2(totalHt + tva)
  const acompte60 = r2(netAPayer * 0.6)
  const solde40 = r2(netAPayer - acompte60)

  return {
    phases,
    suiviJeh,
    suiviPrixJeh,
    suiviTotal,
    totalPhasesJeh,
    margePct,
    margeJe,
    fraisStructure,
    totalJehHt,
    totalHt,
    tvaPct,
    tva,
    netAPayer,
    acompte60,
    solde40,
  }
}

export function fmtEURBudget(n: number | null | undefined): string {
  const v = Number(n ?? 0)
  return (
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v) + " €"
  )
}
