import { describe, expect, it } from "vitest"
import {
  candidaturesDeposees,
  libelleMission,
  libelleStatutCandidature,
  missionsEnCours,
  missionsRetenues,
  nbEtudesEnCours,
  resumeCandidatures,
  retributionsIntervenant,
  sousTitreCandidatures,
  type CandidatureTableauDeBord,
  type MissionTableauDeBord,
} from "./intervenant"

const MOI = "moi"
const RH = "rh"

const etude2620 = { id: "e2620", statut: "signee" }

function mission(id: string, extra: Partial<MissionTableauDeBord> = {}): MissionTableauDeBord {
  return {
    id,
    nom: `Mission ${id}`,
    statut: "ouverte",
    etude_id: etude2620.id,
    etudes: etude2620,
    remuneration: 311,
    nb_jeh: 2,
    nb_intervenants: 1,
    ...extra,
  }
}

function cand(
  id: string,
  m: MissionTableauDeBord | null,
  extra: Partial<CandidatureTableauDeBord> = {}
): CandidatureTableauDeBord {
  return {
    id,
    personne_id: MOI,
    mission_id: m?.id ?? `supprimee-${id}`,
    created_by: null,
    statut: "en_attente",
    created_at: "2026-09-26T19:14:29Z",
    missions: m,
    ...extra,
  }
}

// Situation réelle de Baptiste (étude 2620) : affecté d'office au suivi de
// l'étude le 25/09 par un membre, puis candidature à une mission le 26/09.
const sdp = mission("sdp", { nom: "Suivi de l'étude", remuneration: 901 })
const contenus = mission("contenus", { nom: "Création de contenus stratégiques", nb_intervenants: 26 })
const baptiste: CandidatureTableauDeBord[] = [
  cand("c2", contenus, { statut: "acceptee", created_at: "2026-09-26T19:14:29Z" }),
  cand("c1", sdp, { statut: "acceptee", created_by: RH, created_at: "2026-09-25T16:09:19Z" }),
]

describe("candidaturesDeposees", () => {
  it("aucune candidature", () => {
    expect(candidaturesDeposees([])).toEqual([])
  })

  it("écarte les affectations directes (créées par un tiers)", () => {
    expect(candidaturesDeposees(baptiste).map((c) => c.id)).toEqual(["c2"])
  })

  it("garde une candidature créée par l'intervenant lui-même", () => {
    const c = cand("c", contenus, { created_by: MOI })
    expect(candidaturesDeposees([c])).toHaveLength(1)
  })

  it("ne compte qu'une candidature par mission, la plus récente", () => {
    const ancienne = cand("a", contenus, { created_at: "2026-09-25T10:00:00Z" })
    const recente = cand("b", contenus, { created_at: "2026-09-26T10:00:00Z", statut: "acceptee" })
    expect(candidaturesDeposees([ancienne, recente]).map((c) => c.id)).toEqual(["b"])
  })

  it("trie de la plus récente à la plus ancienne", () => {
    const a = cand("a", mission("m1"), { created_at: "2026-09-20T10:00:00Z" })
    const b = cand("b", mission("m2"), { created_at: "2026-09-27T10:00:00Z" })
    expect(candidaturesDeposees([a, b]).map((c) => c.id)).toEqual(["b", "a"])
  })
})

describe("resumeCandidatures + sousTitreCandidatures", () => {
  it("0 candidature", () => {
    const resume = resumeCandidatures([])
    expect(resume).toEqual({ total: 0, enAttente: 0, acceptees: 0, refusees: 0 })
    expect(sousTitreCandidatures(resume)).toBe("Aucune candidature")
  })

  it("1 candidature en attente", () => {
    const resume = resumeCandidatures([cand("c", contenus)])
    expect(resume.total).toBe(1)
    expect(sousTitreCandidatures(resume)).toBe("1 en attente · 0 acceptée")
  })

  it("plusieurs candidatures, pluriel accordé", () => {
    const resume = resumeCandidatures([
      cand("a", mission("m1"), { statut: "acceptee" }),
      cand("b", mission("m2"), { statut: "acceptee" }),
      cand("c", mission("m3")),
      cand("d", mission("m4"), { statut: "refusee" }),
    ])
    expect(resume).toEqual({ total: 4, enAttente: 1, acceptees: 2, refusees: 1 })
    expect(sousTitreCandidatures(resume)).toBe("1 en attente · 2 acceptées")
  })
})

describe("missionsRetenues / missionsEnCours / nbEtudesEnCours", () => {
  it("0 candidature : rien en cours", () => {
    expect(missionsRetenues([])).toEqual([])
    expect(nbEtudesEnCours(missionsEnCours([]))).toBe(0)
  })

  it("affectation directe comprise : deux missions, une seule étude", () => {
    const retenues = missionsRetenues(baptiste)
    expect(retenues.map((m) => m.id).sort()).toEqual(["contenus", "sdp"])
    expect(missionsEnCours(retenues)).toHaveLength(2)
    expect(nbEtudesEnCours(missionsEnCours(retenues))).toBe(1)
  })

  it("ignore les candidatures en attente ou refusées", () => {
    const retenues = missionsRetenues([
      cand("a", mission("m1")),
      cand("b", mission("m2"), { statut: "refusee" }),
    ])
    expect(retenues).toEqual([])
  })

  it("ignore une mission illisible (RLS) plutôt que de planter", () => {
    expect(missionsRetenues([cand("a", null, { statut: "acceptee" })])).toEqual([])
  })

  it("une mission terminée, payée ou annulée n'est plus en cours", () => {
    const retenues = ["terminee", "payee", "annulee", "en_cours", "pourvue"].map((statut) =>
      mission(statut, { statut })
    )
    expect(missionsEnCours(retenues).map((m) => m.id)).toEqual(["en_cours", "pourvue"])
  })

  it("une étude terminée ou annulée ne compte pas ; une étude illisible compte par son id", () => {
    const missions = [
      mission("m1", { etude_id: "fini", etudes: { id: "fini", statut: "terminee" } }),
      mission("m2", { etude_id: "stop", etudes: { id: "stop", statut: "annulee" } }),
      mission("m3", { etude_id: "cachee", etudes: null }),
      mission("m4", { etude_id: null, etudes: null }),
    ]
    expect(nbEtudesEnCours(missions)).toBe(1)
  })
})

describe("retributionsIntervenant", () => {
  it("0 mission retenue : 0 € prévu, 0 € versé", () => {
    expect(retributionsIntervenant([], [])).toEqual({ prevu: 0, verse: 0 })
  })

  it("somme des rétributions par intervenant (jamais × nb_jeh ni × nb_intervenants)", () => {
    expect(retributionsIntervenant(missionsRetenues(baptiste), [])).toEqual({ prevu: 1212, verse: 0 })
  })

  it("une ligne de rétribution fait foi pour le montant et le versement", () => {
    const records = [{ mission_id: "contenus", montant: 300, date_paiement: "2026-10-15" }]
    expect(retributionsIntervenant(missionsRetenues(baptiste), records)).toEqual({ prevu: 1201, verse: 300 })
  })

  it("un BV émis mais non payé n'est pas versé", () => {
    const records = [{ mission_id: "sdp", montant: "901.00", date_paiement: null }]
    expect(retributionsIntervenant(missionsRetenues(baptiste), records)).toEqual({ prevu: 1212, verse: 0 })
  })

  it("une mission annulée sans versement ne rapporte rien", () => {
    const annulee = mission("x", { statut: "annulee" })
    expect(retributionsIntervenant([annulee], [])).toEqual({ prevu: 0, verse: 0 })
    const payee = [{ mission_id: "x", montant: 311, date_paiement: "2026-09-01" }]
    expect(retributionsIntervenant([annulee], payee)).toEqual({ prevu: 311, verse: 311 })
  })

  it("repli sur taux_jour × nb_jeh quand la rémunération n'est pas saisie", () => {
    const m = mission("p", { remuneration: null, taux_jour: 150, nb_jeh: 2 })
    expect(retributionsIntervenant([m], [])).toEqual({ prevu: 300, verse: 0 })
  })

  it("ignore une ligne de rétribution d'une mission où l'intervenant n'est pas retenu", () => {
    const records = [{ mission_id: "ailleurs", montant: 500, date_paiement: "2026-09-01" }]
    expect(retributionsIntervenant([], records)).toEqual({ prevu: 0, verse: 0 })
  })
})

describe("libellés", () => {
  it("statut en texte", () => {
    expect(libelleStatutCandidature("en_attente")).toBe("En attente")
    expect(libelleStatutCandidature("acceptee")).toBe("Acceptée")
    expect(libelleStatutCandidature("refusee")).toBe("Refusée")
  })

  it("libellé de secours quand la mission est illisible ou sans nom", () => {
    expect(libelleMission(cand("a", null))).toBe("Mission indisponible")
    expect(libelleMission(cand("b", mission("m", { nom: "  " })))).toBe("Mission indisponible")
    expect(libelleMission(cand("c", sdp))).toBe("Suivi de l'étude")
  })
})
