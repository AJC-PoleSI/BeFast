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
 * `agregerParPersonne` et `kpisRetributions` supposent en plus au plus une
 * ligne par couple (mission, personne) — invariant garanti par la contrainte
 * unique `retributions_mission_personne_unique` de la migration 067 — sans
 * quoi les totaux compteraient des montants en double.
 */

/** Arrondi au centime, pour ne pas traîner de flottants dans les totaux. */
export function round2(n: number): number {
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
  /**
   * Personne assignée directement sur la mission — seule trace en base de qui
   * la mission visait au moment du paiement historique. C'est la SEULE
   * information qui permette de rattacher `date_paiement`/`numero_bv` à une
   * personne précise : `nb_intervenants` ou le nombre d'intervenants
   * sélectionnés aujourd'hui ne prouvent rien (l'intervenant a pu changer
   * depuis le paiement).
   */
  intervenant_id: string | null
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
  /**
   * Ligne informationnelle : paiement historique saisi au niveau mission,
   * qu'aucune personne ne peut revendiquer avec certitude (l'intervenant
   * enregistré au moment du paiement n'est plus l'intervenant sélectionné
   * aujourd'hui, ou n'est pas connu). `false` sur toutes les autres lignes.
   */
  paiementMissionNonAttribue: boolean
}

/**
 * Montant dû à UN intervenant : remuneration × nb_jeh.
 * Le paramètre est volontairement réduit aux deux champs réellement lus, pour
 * que l'appelant qui ne dispose que du barème d'une mission n'ait pas à
 * fabriquer (ni à caster) une `MissionSource` complète.
 */
export function montantParIntervenant(m: Pick<MissionSource, "remuneration" | "nb_jeh">): number {
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

    // Le paiement mission a-t-il été rattaché à une personne précise (ci-dessous)
    // ou à la ligne d'alerte « aucun intervenant sélectionné » ? Sert à décider,
    // en fin de boucle, si une ligne informationnelle doit être ajoutée pour ne
    // pas perdre le paiement.
    let paiementMissionRattache = false

    for (const i of liste) {
      const rec = recParPersonne.get(i.personne_id)
      // Mission payée avant la migration 067 : le paiement vit encore sur la
      // ligne mission, on ne le rattache à un intervenant que si c'est
      // PROUVABLE — `missions.intervenant_id` est la seule trace en base de
      // qui la mission visait au moment du paiement. Se fier à
      // `liste.length === 1` (l'ancienne règle) ne prouvait rien : rien
      // n'empêche l'intervenant unique d'avoir changé depuis le paiement
      // (candidature révoquée puis remplacée), ce qui affichait la mauvaise
      // personne comme payée. `recs.length === 0` évite en plus de reprendre
      // un paiement déjà couvert par une ligne `retributions` existante
      // (orpheline ou non) — sinon un même versement pouvait être compté à la
      // fois sur la ligne orpheline et sur l'intervenant actuel.
      const herite = !rec && recs.length === 0 && m.intervenant_id === i.personne_id
      if (herite) paiementMissionRattache = true
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
        paiementMissionNonAttribue: false,
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
        paiementMissionNonAttribue: false,
      })
    }

    const manquants = Math.max(effectifDeclare(m) - liste.length, 0)
    if (manquants > 0) {
      // Le paiement mission n'est repris ici que si personne n'est sélectionné,
      // sinon il a déjà été rattaché à l'intervenant unique ci-dessus (ou reste
      // orphelin, traité par la ligne informationnelle plus bas).
      const paiementMissionRepris = liste.length === 0
      if (paiementMissionRepris) paiementMissionRattache = true
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
        paiementMissionNonAttribue: false,
      })
    }

    // Ligne informationnelle : la mission porte un paiement historique
    // (`date_paiement` ou `numero_bv`) qu'aucune ligne ci-dessus n'a repris —
    // ni un intervenant prouvé (herite), ni la ligne d'alerte (mission sans
    // aucun intervenant sélectionné). Cas concret : la candidature acceptée au
    // moment du paiement a depuis été révoquée et remplacée (le nouvel
    // intervenant n'a aucun droit sur ce paiement), ou la migration 067 a
    // laissé `missions.date_paiement` en place après avoir recopié le
    // paiement vers `retributions` pour un intervenant qui a changé depuis.
    // Montant volontairement à 0 : personne ne sait qui a été payé, compter ce
    // montant une deuxième fois gonflerait le KPI « Rétribution versée » alors
    // que les lignes par personne ci-dessus restent, elles, légitimement dues.
    const paiementMission = !!(m.date_paiement || m.numero_bv)
    if (paiementMission && liste.length > 0 && !paiementMissionRattache) {
      rows.push({
        ...commun,
        key: `${m.id}:_paiement_mission`,
        personne_id: null,
        intervenant_nom: null,
        numero_bv: m.numero_bv,
        date_paiement: m.date_paiement,
        paye: true,
        montant: 0,
        orphelin: false,
        manquants: 0,
        paiementMissionNonAttribue: true,
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

/** Récapitulatif de rétribution pour une personne, toutes missions confondues. */
export type RetributionParPersonne = {
  personne_id: string
  intervenant_nom: string
  nbMissions: number
  nbBv: number
  totalDu: number
  totalVerse: number
}

/** Agrège les lignes par personne, triées par montant dû décroissant. */
export function agregerParPersonne(rows: RetributionRow[]): RetributionParPersonne[] {
  const parPersonne = new Map<string, RetributionParPersonne>()
  for (const row of rows) {
    if (!row.personne_id) continue
    let agg = parPersonne.get(row.personne_id)
    if (!agg) {
      agg = {
        personne_id: row.personne_id,
        intervenant_nom: row.intervenant_nom ?? "—",
        nbMissions: 0,
        nbBv: 0,
        totalDu: 0,
        totalVerse: 0,
      }
      parPersonne.set(row.personne_id, agg)
    }
    // Une ligne orpheline sans nom stocké peut être rencontrée avant une autre
    // ligne de la même personne qui, elle, porte un nom : on complète dès que
    // possible plutôt que de rester bloqué sur le placeholder "—".
    if (agg.intervenant_nom === "—" && row.intervenant_nom) {
      agg.intervenant_nom = row.intervenant_nom
    }
    agg.nbMissions += 1
    if (row.numero_bv) agg.nbBv += 1
    if (row.paye) agg.totalVerse = round2(agg.totalVerse + row.montant)
    else agg.totalDu = round2(agg.totalDu + row.montant)
  }
  return Array.from(parPersonne.values()).sort(
    (a, b) => b.totalDu - a.totalDu || a.intervenant_nom.localeCompare(b.intervenant_nom, "fr")
  )
}

/** KPI de l'en-tête trésorerie. */
export type RetributionKpis = {
  totalRetributionDue: number
  totalRetributionVersee: number
  nbRetributionsAPayer: number
}

/** KPI de l'en-tête trésorerie, calculés sur les lignes de rétribution. */
export function kpisRetributions(rows: RetributionRow[]): RetributionKpis {
  let totalRetributionDue = 0
  let totalRetributionVersee = 0
  let nbRetributionsAPayer = 0
  for (const row of rows) {
    if (row.paye) {
      totalRetributionVersee = round2(totalRetributionVersee + row.montant)
    } else {
      totalRetributionDue = round2(totalRetributionDue + row.montant)
      nbRetributionsAPayer += 1
    }
  }
  return { totalRetributionDue, totalRetributionVersee, nbRetributionsAPayer }
}
