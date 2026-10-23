import { describe, it, expect } from "vitest"
import {
  motifRefusAffectation,
  missionComplete,
  missionsOuvertesACandidature,
  estAffectationDirecte,
  avertissementsAffectation,
  filtrerAffectables,
} from "./affectation"

const valide = { account_status: "validated" }

describe("missionComplete", () => {
  it("complète quand le nombre d'acceptés atteint le nombre d'intervenants", () => {
    expect(missionComplete(26, 26)).toBe(true)
    expect(missionComplete(25, 26)).toBe(false)
  })

  it("une mission sans nombre d'intervenants en compte un", () => {
    expect(missionComplete(0, null)).toBe(false)
    expect(missionComplete(1, null)).toBe(true)
  })
})

describe("motifRefusAffectation", () => {
  const base = { personne: valide, dejaSurMission: false, accepteesCount: 0, nbIntervenants: 26 }

  it("autorise un compte validé sur une mission non complète", () => {
    expect(motifRefusAffectation(base)).toBeNull()
  })

  it("refuse une personne introuvable", () => {
    expect(motifRefusAffectation({ ...base, personne: null })).toMatch(/introuvable/)
  })

  it("autorise un compte en attente de validation (l'avertissement est affiché à part)", () => {
    expect(
      motifRefusAffectation({ ...base, personne: { account_status: "pending_validation" } })
    ).toBeNull()
  })

  it("refuse un compte rejeté ou supprimé", () => {
    expect(
      motifRefusAffectation({ ...base, personne: { account_status: "rejected" } })
    ).toMatch(/rejeté/)
    expect(
      motifRefusAffectation({ ...base, personne: { account_status: "deleted" } })
    ).toMatch(/actif/)
  })

  it("refuse une personne déjà positionnée sur la mission", () => {
    expect(motifRefusAffectation({ ...base, dejaSurMission: true })).toMatch(/déjà/)
  })

  it("refuse quand la mission est complète", () => {
    expect(motifRefusAffectation({ ...base, accepteesCount: 26 })).toMatch(/complète/)
  })
})

describe("avertissementsAffectation", () => {
  it("aucun avertissement pour un compte validé au dossier complet", () => {
    expect(avertissementsAffectation({ account_status: "validated", manquants: [] })).toEqual([])
  })

  it("signale un compte en attente de validation", () => {
    expect(avertissementsAffectation({ account_status: "pending_validation", manquants: [] })).toEqual([
      "Compte en attente de validation",
    ])
  })

  it("liste ce qui manque au dossier, en clair", () => {
    expect(
      avertissementsAffectation({
        account_status: "validated",
        manquants: ["portable", "code_postal", "carte_etudiante"],
      })
    ).toEqual(["Dossier incomplet : téléphone, code postal, carte étudiante"])
  })
})

describe("filtrerAffectables", () => {
  const comptes = [
    { id: "1", prenom: "Léa", nom: "Dupont", email: "lea.dupont@audencia.com" },
    { id: "2", prenom: "Nathalène", nom: "Auclair", email: "nathalene.auclair@audencia.com" },
    { id: "3", prenom: "Louis", nom: "Polaert", email: "louis.polaert@audencia.com" },
  ]

  it("ignore les accents et la casse", () => {
    expect(filtrerAffectables(comptes, "lea").map((c) => c.id)).toEqual(["1"])
    expect(filtrerAffectables(comptes, "NATHALENE").map((c) => c.id)).toEqual(["2"])
  })

  it("exige tous les mots, dans n'importe quel champ", () => {
    expect(filtrerAffectables(comptes, "louis polaert").map((c) => c.id)).toEqual(["3"])
    expect(filtrerAffectables(comptes, "louis dupont")).toEqual([])
  })

  it("ne renvoie rien sous 2 caractères", () => {
    expect(filtrerAffectables(comptes, "l")).toEqual([])
    expect(filtrerAffectables(comptes, "  ")).toEqual([])
  })

  it("plafonne le nombre de résultats", () => {
    expect(filtrerAffectables(comptes, "audencia", 2)).toHaveLength(2)
  })
})

describe("estAffectationDirecte", () => {
  it("vrai quand la candidature a été créée par quelqu'un d'autre que l'intervenant", () => {
    expect(estAffectationDirecte({ personne_id: "u1", created_by: "admin" })).toBe(true)
  })

  it("faux pour une candidature déposée par l'intervenant lui-même", () => {
    expect(estAffectationDirecte({ personne_id: "u1", created_by: null })).toBe(false)
    expect(estAffectationDirecte({ personne_id: "u1", created_by: "u1" })).toBe(false)
  })
})

describe("missionsOuvertesACandidature", () => {
  const missions = [
    { id: "a", nb_intervenants: 2 },
    { id: "b", nb_intervenants: 1 },
    { id: "c", nb_intervenants: null },
  ]

  it("masque les missions dont tous les intervenants sont retenus", () => {
    const acceptees = new Map([["a", 2], ["b", 0], ["c", 1]])
    expect(missionsOuvertesACandidature(missions, acceptees).map((m) => m.id)).toEqual(["b"])
  })

  it("garde une mission encore incomplète", () => {
    const acceptees = new Map([["a", 1]])
    expect(missionsOuvertesACandidature(missions, acceptees).map((m) => m.id)).toEqual(["a", "b", "c"])
  })

  it("masque une mission à 26 places dès que 26 candidats sont acceptés", () => {
    const m = [{ id: "x", nb_intervenants: 26 }]
    expect(missionsOuvertesACandidature(m, new Map([["x", 25]]))).toHaveLength(1)
    expect(missionsOuvertesACandidature(m, new Map([["x", 26]]))).toHaveLength(0)
  })
})
