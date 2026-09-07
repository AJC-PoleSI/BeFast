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
//
// La marge n'est jamais montrée au client : elle est refondue dans le prix
// unitaire de chaque ligne (`prixJehMarge`), de sorte que le tableau de la
// facture — « Désignation / Nombre de JEH / Montant unitaire / Montant HT » —
// se totalise exactement au Total prestation. `totalJehHt` est donc la somme
// des lignes grossies, et `margeJe` l'écart avec le SDP brut.
//
// TVA : assiette = TOTAL HT (prestation JEH **et** frais de structure), comme
// sur les factures et les slides budget émises par AJC (20 % × 5 000 = 1 000).

export interface BudgetPhaseInput {
  name: string
  jehCount: number
  jehPrice: number
}

// Un versement des modalités de règlement (ex. « Acompte 40 % à la signature »).
export interface PaiementVersementInput {
  label: string
  pct: number
}

export type PaiementType = "standard" | "pvri"

export interface PaiementModalites {
  type: PaiementType
  versements: PaiementVersementInput[]
}

export interface BudgetInput {
  phases: BudgetPhaseInput[]
  suiviJehCount: number
  suiviJehPrice: number
  margeJePct: number
  fraisDossier: number
  globalFraisAnnexes: number
  tvaPct?: number // défaut 20
  // Schéma de versements optionnel. Si absent → standard 60 % / 40 %.
  paiementModalites?: PaiementModalites | null
}

export interface PaiementVersementLine {
  label: string
  pct: number
  montant: number // part du net à payer (TTC)
}

export interface BudgetPhaseLine {
  name: string
  jeh: number
  prixJeh: number // « Montant » unitaire par JEH, SDP brut (hors marge)
  montant: number // « TOTAL » de la ligne = jeh × prixJeh
  prixJehMarge: number // prix unitaire marge incluse — c'est celui facturé au client
  montantMarge: number // jeh × prixJehMarge
}

export interface BudgetBreakdown {
  phases: BudgetPhaseLine[]
  suiviJeh: number
  suiviPrixJeh: number
  suiviTotal: number
  suiviPrixJehMarge: number // prix unitaire du suivi, marge incluse
  suiviTotalMarge: number // suiviJeh × suiviPrixJehMarge
  totalPhasesJeh: number
  margePct: number
  margeJe: number
  fraisStructure: number
  totalJehHt: number // phases + suivi + marge (la marge est « fondue » dans le JEH)
  totalHt: number // totalJehHt + frais de structure
  tvaPct: number
  tva: number // calculée sur le TOTAL HT (prestation + frais de structure)
  netAPayer: number // TTC
  acompte60: number // 60 % à la signature (compat. schéma standard par défaut)
  solde40: number // 40 % au PV de recette (compat. schéma standard par défaut)
  paiementType: PaiementType
  versements: PaiementVersementLine[] // modalités de règlement résolues en €
}

// Schémas de versements par défaut (les % restent modifiables côté CDP/trésorier).
export const DEFAULT_MODALITES: Record<PaiementType, PaiementVersementInput[]> = {
  standard: [
    { label: "Acompte à la signature de la convention d'étude", pct: 60 },
    { label: "Solde au procès-verbal de recette final", pct: 40 },
  ],
  pvri: [
    { label: "Acompte à la signature de la convention d'étude", pct: 40 },
    { label: "Procès-verbal de règlement intermédiaire", pct: 30 },
    { label: "Solde au procès-verbal de recette final", pct: 30 },
  ],
}

// Répartit `netAPayer` sur les versements selon leurs %. Le dernier versement
// absorbe l'écart d'arrondi pour que la somme égale exactement le net à payer.
function resolveVersements(
  netAPayer: number,
  modalites: PaiementModalites | null | undefined
): { type: PaiementType; lines: PaiementVersementLine[] } {
  const type: PaiementType = modalites?.type ?? "standard"
  const source =
    modalites?.versements && modalites.versements.length > 0
      ? modalites.versements
      : DEFAULT_MODALITES[type] ?? DEFAULT_MODALITES.standard

  const lines: PaiementVersementLine[] = []
  let cumul = 0
  source.forEach((v, i) => {
    const pct = Number(v.pct || 0)
    const isLast = i === source.length - 1
    const montant = isLast ? r2(netAPayer - cumul) : r2(netAPayer * (pct / 100))
    cumul = r2(cumul + montant)
    lines.push({ label: v.label || `Versement ${i + 1}`, pct, montant })
  })
  return { type, lines }
}

const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

export function computeBudget(input: BudgetInput): BudgetBreakdown {
  const tvaPct = input.tvaPct ?? 20

  const phases: BudgetPhaseLine[] = (input.phases ?? []).map((p) => {
    const jeh = Number(p.jehCount || 0)
    const prixJeh = Number(p.jehPrice || 0)
    return {
      name: p.name,
      jeh,
      prixJeh,
      montant: r2(jeh * prixJeh),
      prixJehMarge: prixJeh,
      montantMarge: r2(jeh * prixJeh),
    }
  })

  const totalPhasesJeh = r2(phases.reduce((s, p) => s + p.montant, 0))

  const suiviJeh = Number(input.suiviJehCount || 0)
  const suiviPrixJeh = Number(input.suiviJehPrice || 0)
  const suiviTotal = r2(suiviJeh * suiviPrixJeh)

  // À 100 % de marge, (1 - margePct/100) vaut 0 : la division produirait
  // Infinity. Une marge de 100 % n'a pas de sens économique (prix infini) —
  // on la plafonne à 99 % plutôt que de laisser passer un budget à Infinity/NaN.
  const margePct = Math.min(Number(input.margeJePct || 0), 99)
  const margeBase = r2(totalPhasesJeh + suiviTotal)
  const cibleJehHt =
    margePct > 0 && margeBase > 0
      ? Math.ceil(margeBase / (1 - margePct / 100))
      : margeBase

  // Refonte de la marge dans les prix unitaires : chaque ligne est grossie du
  // même facteur, puis son montant est recalculé (jeh × prix arrondi) pour que
  // « Nombre de JEH × Montant unitaire = Montant HT » reste exact ligne à ligne
  // sur la facture. `totalJehHt` est la somme de ces lignes — à quelques
  // centimes d'arrondi près du ROUNDUP Excel, jamais au-delà.
  const facteurMarge = margeBase > 0 ? cibleJehHt / margeBase : 1
  for (const p of phases) {
    p.prixJehMarge = r2(p.prixJeh * facteurMarge)
    p.montantMarge = r2(p.jeh * p.prixJehMarge)
  }
  const suiviPrixJehMarge = r2(suiviPrixJeh * facteurMarge)
  const suiviTotalMarge = r2(suiviJeh * suiviPrixJehMarge)

  const fraisStructure = r2(
    Number(input.fraisDossier || 0) + Number(input.globalFraisAnnexes || 0)
  )

  const totalJehHt = r2(
    phases.reduce((s, p) => s + p.montantMarge, 0) + suiviTotalMarge
  )
  const margeJe = r2(totalJehHt - margeBase)
  const totalHt = r2(totalJehHt + fraisStructure)
  // Assiette TVA = TOTAL HT, frais de structure compris (cf. en-tête).
  const tva = r2(totalHt * (tvaPct / 100))
  const netAPayer = r2(totalHt + tva)
  const acompte60 = r2(netAPayer * 0.6)
  const solde40 = r2(netAPayer - acompte60)

  const { type: paiementType, lines: versements } = resolveVersements(
    netAPayer,
    input.paiementModalites
  )

  return {
    phases,
    suiviJeh,
    suiviPrixJeh,
    suiviTotal,
    suiviPrixJehMarge,
    suiviTotalMarge,
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
    paiementType,
    versements,
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
