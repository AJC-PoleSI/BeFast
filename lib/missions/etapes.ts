// Découpage d'une mission en étapes pour le Récapitulatif de Mission (RDM).
//
// Règle validée par Felix (24/10/2026, RDM 26 RDM28 20) : une mission de N JEH
// donne N étapes d'1 JEH. La durée se répartit par semaines entières (17
// semaines sur 2 JEH ⇒ 8 puis 9) et la rétribution au prorata des jours de
// chaque étape (311 € ⇒ 146 € + 165 €). La 2ᵉ étape poursuit la mission
// décrite à l'étape 1. Une mission à 1 JEH, sans dates ou plus courte que son
// nombre de JEH reste une seule étape.

export type Etape = {
  numero: number
  /** « Étape 1 : Ambassadeurs digitaux… » — colonne « Numéro et nom de l'étape ». */
  intitule: string
  contenu: string
  jeh: number
  /** JJ/MM/AAAA */
  debut: string
  fin: string
  /** Part de la rétribution de l'intervenant au titre de cette étape. */
  retribution: number
}

export type EntreeEtapes = {
  nom?: string | null
  description?: string | null
  nbJeh: number
  remuneration: number
  /** YYYY-MM-DD */
  dateDebut?: string | null
  dateFin?: string | null
}

const JOUR_MS = 24 * 60 * 60 * 1000
const CONTENU_POURSUITE = "Poursuite de la mission décrite à l'étape 1, sans changement de nature du travail."

/**
 * Les missions importées portent leurs dates dans le nom
 * (« Ambassadeurs digitaux - Création de contenus stratégiques. 05/10/2026 → 31/01/2027 ») :
 * le RDM les affiche dans leur propre colonne, on les retire du nom.
 */
export function nomSansDates(nom: string | null | undefined): string {
  return String(nom ?? "")
    .replace(/\.?\s*\d{2}\/\d{2}\/\d{4}\s*(?:→|->|—|–|-|au)\s*\d{2}\/\d{2}\/\d{4}\s*$/u, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** JJ/MM/AAAA depuis un instant UTC : aucun décalage de fuseau possible. */
function formatDateFR(t: number): string {
  const d = new Date(t)
  const dd = String(d.getUTCDate()).padStart(2, "0")
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0")
  return `${dd}/${mm}/${d.getUTCFullYear()}`
}

const intitule = (numero: number, texte: string) => `Étape ${numero} : ${texte}`.trim()

function parseISO(iso: string | null | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""))
  if (!m) return null
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(t) ? null : t
}

const arrondi = (n: number, entier: boolean) => (entier ? Math.round(n) : Math.round(n * 100) / 100)

export function decouperEnEtapes(entree: EntreeEtapes): Etape[] {
  const nom = nomSansDates(entree.nom)
  const description = String(entree.description ?? "").trim()
  const debut = parseISO(entree.dateDebut)
  const fin = parseISO(entree.dateFin)
  const jehTotal = Number(entree.nbJeh) || 0
  const remuneration = Number(entree.remuneration) || 0

  const unique = (): Etape[] => [
    {
      numero: 1,
      intitule: intitule(1, nom),
      contenu: description,
      jeh: jehTotal,
      debut: debut === null ? "" : formatDateFR(debut),
      fin: fin === null ? "" : formatDateFR(fin),
      retribution: remuneration,
    },
  ]

  if (debut === null || fin === null || fin < debut) return unique()
  if (!Number.isInteger(jehTotal) || jehTotal < 2) return unique()

  const joursTotal = Math.round((fin - debut) / JOUR_MS) + 1
  // Même convention que {mission.duree} : semaines entamées sur l'écart de dates.
  const semainesTotal = Math.ceil(Math.round((fin - debut) / JOUR_MS) / 7)
  if (semainesTotal < jehTotal) return unique()

  const entiere = Number.isInteger(remuneration)
  const etapes: Etape[] = []
  let jourCourant = debut
  let deja = 0
  for (let i = 1; i <= jehTotal; i++) {
    const derniere = i === jehTotal
    const semainesCumulees = Math.floor((i * semainesTotal) / jehTotal)
    const finEtape = derniere ? fin : debut + (semainesCumulees * 7 - 1) * JOUR_MS
    const jours = Math.round((finEtape - jourCourant) / JOUR_MS) + 1
    const part = derniere ? arrondi(remuneration - deja, entiere) : arrondi((remuneration * jours) / joursTotal, entiere)
    deja += part
    etapes.push({
      numero: i,
      intitule: intitule(i, i === 1 ? nom : "Poursuite de l'étape 1"),
      contenu: i === 1 ? description : CONTENU_POURSUITE,
      jeh: 1,
      debut: formatDateFR(jourCourant),
      fin: formatDateFR(finEtape),
      retribution: part,
    })
    jourCourant = finEtape + JOUR_MS
  }
  return etapes
}

const liste = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`

const euros = (n: number) => String(n).replace(".", ",")

/** Textes du RDM qui récapitulent les étapes (article 2 et article 3). */
export function resumeEtapes(etapes: Etape[]): {
  plusieurs_etapes: boolean
  dates_fin_phases: string
  detail_phases: string
} {
  if (etapes.length < 2) {
    return { plusieurs_etapes: false, dates_fin_phases: etapes[0]?.fin ?? "", detail_phases: "" }
  }
  return {
    plusieurs_etapes: true,
    dates_fin_phases: liste(etapes.map((e) => `${e.fin} (phase ${e.numero})`)),
    detail_phases: `, dont ${liste(etapes.map((e) => `${euros(e.retribution)}€ bruts au titre de la phase ${e.numero}`))}`,
  }
}
