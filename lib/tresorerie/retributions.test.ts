import { describe, it, expect } from "vitest"
import {
  buildRetributionRows,
  nextNumeroBV,
  agregerParPersonne,
  kpisRetributions,
  type MissionSource,
  type IntervenantSource,
  type RetributionRecord,
} from "./retributions"

const mission = (over: Partial<MissionSource> = {}): MissionSource => ({
  id: "m1",
  nom: "Création de contenus",
  etude_id: "e1",
  etude_numero: "2620",
  etude_nom: "Étude contenus",
  date_debut: "2026-10-05",
  date_fin: "2026-11-29",
  remuneration: 100,
  nb_jeh: 2,
  nb_intervenants: 3,
  date_paiement: null,
  numero_bv: null,
  ...over,
})

const inter = (personne_id: string, nom: string, mission_id = "m1"): IntervenantSource => ({
  mission_id,
  personne_id,
  nom,
})

const record = (over: Partial<RetributionRecord> = {}): RetributionRecord => ({
  mission_id: "m1",
  personne_id: "p1",
  personne_nom: "Alice Martin",
  numero_bv: "BV-2026-001",
  date_paiement: "2026-12-01",
  montant: 200,
  ...over,
})

describe("nextNumeroBV", () => {
  it("démarre à 001 quand aucun numéro n'existe", () => {
    expect(nextNumeroBV([], 2026)).toBe("BV-2026-001")
  })

  it("incrémente le plus grand numéro de l'année", () => {
    expect(nextNumeroBV(["BV-2026-001", "BV-2026-009", "BV-2026-004"], 2026)).toBe("BV-2026-010")
  })

  it("ignore les numéros des autres années", () => {
    expect(nextNumeroBV(["BV-2025-042"], 2026)).toBe("BV-2026-001")
  })

  it("ignore les numéros libres saisis à la main et les valeurs nulles", () => {
    expect(nextNumeroBV(["virement mars", null, undefined, "BV-2026-002"], 2026)).toBe("BV-2026-003")
  })

  it("passe à 4 chiffres au-delà de 999 sans tronquer", () => {
    expect(nextNumeroBV(["BV-2026-999"], 2026)).toBe("BV-2026-1000")
  })
})

describe("buildRetributionRows", () => {
  it("crée une ligne par intervenant sélectionné, au montant unitaire remuneration × nb_jeh", () => {
    const rows = buildRetributionRows(
      [mission({ nb_intervenants: 2 })],
      [inter("p1", "Alice Martin"), inter("p2", "Bob Durand")],
      []
    )
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.intervenant_nom)).toEqual(["Alice Martin", "Bob Durand"])
    expect(rows.every((r) => r.montant === 200)).toBe(true)
    expect(rows.every((r) => r.paye === false)).toBe(true)
  })

  it("marque payée la seule ligne qui a une rétribution enregistrée", () => {
    const rows = buildRetributionRows(
      [mission({ nb_intervenants: 2 })],
      [inter("p1", "Alice Martin"), inter("p2", "Bob Durand")],
      [record({ personne_id: "p1" })]
    )
    const alice = rows.find((r) => r.personne_id === "p1")!
    const bob = rows.find((r) => r.personne_id === "p2")!
    expect(alice.paye).toBe(true)
    expect(alice.numero_bv).toBe("BV-2026-001")
    expect(bob.paye).toBe(false)
    expect(bob.numero_bv).toBeNull()
  })

  it("fige le montant enregistré même si le barème de la mission a changé depuis", () => {
    const rows = buildRetributionRows(
      [mission({ nb_intervenants: 1, remuneration: 500 })],
      [inter("p1", "Alice Martin")],
      [record({ montant: 200 })]
    )
    expect(rows[0].montant).toBe(200)
  })

  it("ajoute une ligne d'alerte pour les intervenants déclarés mais non sélectionnés", () => {
    const rows = buildRetributionRows(
      [mission({ nb_intervenants: 3 })],
      [inter("p1", "Alice Martin")],
      []
    )
    const alerte = rows.find((r) => r.personne_id === null)!
    expect(alerte.manquants).toBe(2)
    expect(alerte.montant).toBe(400)
  })

  it("affiche une mission sans aucun intervenant comme une seule ligne d'alerte au montant total", () => {
    const rows = buildRetributionRows([mission({ nb_intervenants: 3 })], [], [])
    expect(rows).toHaveLength(1)
    expect(rows[0].personne_id).toBeNull()
    expect(rows[0].manquants).toBe(3)
    expect(rows[0].montant).toBe(600)
  })

  it("hérite du paiement enregistré au niveau mission quand elle n'a qu'un intervenant", () => {
    const rows = buildRetributionRows(
      [mission({ nb_intervenants: 1, date_paiement: "2026-05-02", numero_bv: "BV-2026-007" })],
      [inter("p1", "Alice Martin")],
      []
    )
    expect(rows[0].paye).toBe(true)
    expect(rows[0].date_paiement).toBe("2026-05-02")
    expect(rows[0].numero_bv).toBe("BV-2026-007")
  })

  it("conserve une ligne payée pour une personne retirée de la mission, signalée orpheline", () => {
    const rows = buildRetributionRows(
      [mission({ nb_intervenants: 1 })],
      [inter("p2", "Bob Durand")],
      [record({ personne_id: "p1", personne_nom: "Alice Martin" })]
    )
    const orpheline = rows.find((r) => r.personne_id === "p1")!
    expect(orpheline.orphelin).toBe(true)
    expect(orpheline.intervenant_nom).toBe("Alice Martin")
    expect(rows.find((r) => r.personne_id === "p2")!.orphelin).toBe(false)
  })

  it("dédoublonne une personne présente à la fois en candidature et en intervenant direct", () => {
    const rows = buildRetributionRows(
      [mission({ nb_intervenants: 1 })],
      [inter("p1", "Alice Martin"), inter("p1", "Alice Martin")],
      []
    )
    expect(rows).toHaveLength(1)
  })

  it("porte les informations d'étude et de mission sur chaque ligne", () => {
    const rows = buildRetributionRows(
      [mission({ nb_intervenants: 1 })],
      [inter("p1", "Alice Martin")],
      []
    )
    expect(rows[0]).toMatchObject({
      mission_id: "m1",
      mission_nom: "Création de contenus",
      etude_id: "e1",
      etude_numero: "2620",
      date_debut: "2026-10-05",
      date_fin: "2026-11-29",
    })
  })

  it("ne fabrique aucune ligne d'alerte quand la mission déclare zéro intervenant", () => {
    const rows = buildRetributionRows([mission({ nb_intervenants: 0 })], [], [])
    expect(rows).toHaveLength(0)
  })

  it("traite un nb_intervenants absent comme un intervenant unique", () => {
    const rows = buildRetributionRows(
      [mission({ nb_intervenants: null as unknown as number })],
      [],
      []
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].manquants).toBe(1)
  })

  it("traite plusieurs missions dans le même appel sans mélanger les lignes", () => {
    const rows = buildRetributionRows(
      [mission({ id: "m1", nb_intervenants: 1 }), mission({ id: "m2", nb_intervenants: 1 })],
      [inter("p1", "Alice Martin", "m1"), inter("p2", "Bob Durand", "m2")],
      []
    )
    expect(rows.map((r) => [r.mission_id, r.personne_id])).toEqual([
      ["m1", "p1"],
      ["m2", "p2"],
    ])
  })

  it("affiche un BV émis mais pas encore payé comme non payé", () => {
    const rows = buildRetributionRows(
      [mission({ nb_intervenants: 1 })],
      [inter("p1", "Alice Martin")],
      [record({ date_paiement: null })]
    )
    expect(rows[0].numero_bv).toBe("BV-2026-001")
    expect(rows[0].paye).toBe(false)
  })

  it("n'ajoute pas de ligne d'alerte quand plus d'intervenants sont sélectionnés que déclarés", () => {
    const rows = buildRetributionRows(
      [mission({ nb_intervenants: 1 })],
      [inter("p1", "Alice Martin"), inter("p2", "Bob Durand")],
      []
    )
    expect(rows).toHaveLength(2)
    expect(rows.some((r) => r.personne_id === null)).toBe(false)
  })
})

describe("agregerParPersonne", () => {
  const rows = buildRetributionRows(
    [
      mission({ id: "m1", nb_intervenants: 2 }),
      mission({ id: "m2", nom: "Focus group", nb_intervenants: 1, remuneration: 300, nb_jeh: 1 }),
    ],
    [
      inter("p1", "Alice Martin", "m1"),
      inter("p2", "Bob Durand", "m1"),
      inter("p1", "Alice Martin", "m2"),
    ],
    [record({ mission_id: "m1", personne_id: "p1" })]
  )

  it("totalise le dû et le versé par personne", () => {
    const agg = agregerParPersonne(rows)
    const alice = agg.find((a) => a.personne_id === "p1")!
    expect(alice.totalVerse).toBe(200)
    expect(alice.totalDu).toBe(300)
    expect(alice.nbMissions).toBe(2)
    expect(alice.nbBv).toBe(1)
  })

  it("ignore les lignes d'alerte sans personne", () => {
    const agg = agregerParPersonne(buildRetributionRows([mission({ nb_intervenants: 3 })], [], []))
    expect(agg).toHaveLength(0)
  })

  it("trie par montant dû décroissant", () => {
    const agg = agregerParPersonne(rows)
    expect(agg.map((a) => a.personne_id)).toEqual(["p1", "p2"])
  })
})

describe("kpisRetributions", () => {
  it("sépare le dû, le versé et le nombre de rétributions à payer", () => {
    const rows = buildRetributionRows(
      [mission({ nb_intervenants: 3 })],
      [inter("p1", "Alice Martin"), inter("p2", "Bob Durand")],
      [record({ personne_id: "p1" })]
    )
    // Alice payée 200 ; Bob dû 200 ; ligne d'alerte 1 × 200 dû.
    const kpis = kpisRetributions(rows)
    expect(kpis.totalRetributionVersee).toBe(200)
    expect(kpis.totalRetributionDue).toBe(400)
    expect(kpis.nbRetributionsAPayer).toBe(2)
  })
})
