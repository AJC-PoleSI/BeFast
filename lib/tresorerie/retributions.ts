/**
 * Rétributions intervenants — logique pure (aucun accès base).
 *
 * Une « rétribution » est le versement dû à UNE personne pour UNE mission.
 * La table `retributions` ne stocke que les lignes déjà traitées (BV émis ou
 * paiement enregistré) : les lignes affichées sont recomposées ici à partir des
 * missions, des intervenants sélectionnés et des lignes déjà écrites.
 *
 * Précondition à charge de l'appelant : `missions` doit contenir toutes les
 * missions référencées par `intervenants` et par `records`. Un enregistrement
 * dont la mission est absente de la liste est silencieusement ignoré.
 */

/** Arrondi au centime, pour ne pas traîner de flottants dans les totaux. */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Mission telle que chargée depuis la base pour le calcul des rétributions. */
export type MissionSource = {
  id: string
  nom: string
  etude_id: string | null
  etude_numero: string | null
  etude_nom: string | null
  date_debut: string | null
  date_fin: string | null
  remuneration: number
  nb_jeh: number
  nb_intervenants: number
  /** Paiement historique saisi au niveau mission (avant la table retributions). */
  date_paiement: string | null
  numero_bv: string | null
}

/** Personne intervenante sur une mission (candidature acceptée ou assignation directe). */
export type IntervenantSource = {
  mission_id: string
  personne_id: string
  nom: string
}

/** Ligne déjà écrite dans la table `retributions`. */
export type RetributionRecord = {
  mission_id: string
  personne_id: string
  personne_nom: string | null
  numero_bv: string | null
  date_paiement: string | null
  montant: number
}

/** Ligne affichée dans le tableau de suivi. */
export type RetributionRow = {
  /** Identifiant stable pour React : `<mission>:<personne>` ou `<mission>:_reste`. */
  key: string
  mission_id: string
  mission_nom: string
  etude_id: string | null
  etude_numero: string | null
  etude_nom: string | null
  date_debut: string | null
  date_fin: string | null
  /** null = ligne d'alerte « intervenants non sélectionnés ». */
  personne_id: string | null
  intervenant_nom: string | null
  numero_bv: string | null
  date_paiement: string | null
  paye: boolean
  montant: number
  /** Payée alors que la personne n'est plus intervenante sur la mission. */
  orphelin: boolean
  /** Nombre d'intervenants déclarés mais non sélectionnés (ligne d'alerte only). */
  manquants: number
}

/** Montant dû à UN intervenant : remuneration × nb_jeh. */
export function montantParIntervenant(m: MissionSource): number {
  return round2(Number(m.remuneration ?? 0) * Number(m.nb_jeh ?? 0))
}

/**
 * Nombre d'intervenants déclarés sur la mission : null/undefined vaut 1 (au
 * moins un intervenant implicite), une valeur non finie (NaN) vaut aussi 1,
 * mais un 0 explicite reste 0 — même convention que `lib/actions/missions.ts`
 * et `lib/actions/tresorerie.ts` (`Number(m.nb_intervenants ?? 1)`). Sans ce
 * garde, une mission déclarant explicitement 0 intervenant fabriquait une
 * ligne d'alerte et un montant dû fictifs.
 */
function effectifDeclare(m: MissionSource): number {
  const n = Number(m.nb_intervenants ?? 1)
  if (!Number.isFinite(n)) return 1
  return Math.max(n, 0)
}

/**
 * Recompose les lignes affichables : une par intervenant sélectionné, plus une
 * ligne d'alerte pour les intervenants déclarés mais jamais sélectionnés (afin
 * que la rétribution due ne disparaisse ni du tableau ni des KPI).
 */
export function buildRetributionRows(
  missions: MissionSource[],
  intervenants: IntervenantSource[],
  records: RetributionRecord[]
): RetributionRow[] {
  const intervenantsParMission = new Map<string, IntervenantSource[]>()
  for (const i of intervenants) {
    const liste = intervenantsParMission.get(i.mission_id) ?? []
    if (!liste.some((x) => x.personne_id === i.personne_id)) liste.push(i)
    intervenantsParMission.set(i.mission_id, liste)
  }

  const recordsParMission = new Map<string, RetributionRecord[]>()
  for (const r of records) {
    const liste = recordsParMission.get(r.mission_id) ?? []
    liste.push(r)
    recordsParMission.set(r.mission_id, liste)
  }

  const rows: RetributionRow[] = []

  for (const m of missions) {
    const liste = intervenantsParMission.get(m.id) ?? []
    const recs = recordsParMission.get(m.id) ?? []
    const recParPersonne = new Map(recs.map((r) => [r.personne_id, r]))
    const unitaire = montantParIntervenant(m)

    const commun = {
      mission_id: m.id,
      mission_nom: m.nom,
      etude_id: m.etude_id,
      etude_numero: m.etude_numero,
      etude_nom: m.etude_nom,
      date_debut: m.date_debut,
      date_fin: m.date_fin,
    }

    for (const i of liste) {
      const rec = recParPersonne.get(i.personne_id)
      // Mission mono-intervenant payée avant la migration : le paiement vit
      // encore sur la ligne mission, on le rattache à son unique intervenant.
      // Limite assumée : ce rattachement ne fonctionne que si la mission a
      // exactement un intervenant sélectionné. Sur une mission à 2+
      // intervenants, rien ne permet de savoir lequel a été payé — ces lignes
      // restent donc affichées comme non payées. La migration 067 a rétabli
      // l'intervenant sur les missions qui portaient un `intervenant_id`,
      // donc en pratique ce cas ne concerne que les missions payées sans
      // aucun intervenant identifié.
      const herite = !rec && liste.length === 1
      const date_paiement = rec ? rec.date_paiement : herite ? m.date_paiement : null
      const numero_bv = rec ? rec.numero_bv : herite ? m.numero_bv : null
      rows.push({
        ...commun,
        key: `${m.id}:${i.personne_id}`,
        personne_id: i.personne_id,
        intervenant_nom: i.nom,
        numero_bv,
        date_paiement,
        paye: !!date_paiement,
        montant: rec ? round2(rec.montant) : unitaire,
        orphelin: false,
        manquants: 0,
      })
    }

    for (const r of recs) {
      if (liste.some((i) => i.personne_id === r.personne_id)) continue
      rows.push({
        ...commun,
        key: `${m.id}:${r.personne_id}`,
        personne_id: r.personne_id,
        intervenant_nom: r.personne_nom,
        numero_bv: r.numero_bv,
        date_paiement: r.date_paiement,
        paye: !!r.date_paiement,
        montant: round2(r.montant),
        orphelin: true,
        manquants: 0,
      })
    }

    const manquants = Math.max(effectifDeclare(m) - liste.length, 0)
    if (manquants > 0) {
      // Le paiement mission n'est repris ici que si personne n'est sélectionné,
      // sinon il a déjà été rattaché à l'intervenant unique ci-dessus.
      const paiementMissionRepris = liste.length === 0
      rows.push({
        ...commun,
        key: `${m.id}:_reste`,
        personne_id: null,
        intervenant_nom: null,
        numero_bv: paiementMissionRepris ? m.numero_bv : null,
        date_paiement: paiementMissionRepris ? m.date_paiement : null,
        paye: paiementMissionRepris ? !!m.date_paiement : false,
        montant: round2(unitaire * manquants),
        orphelin: false,
        manquants,
      })
    }
  }

  return rows
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
