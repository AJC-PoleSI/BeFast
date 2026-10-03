import { describe, it, expect } from "vitest"
import { partitionMesEtudes, ordonnerPourAccueil } from "./mes-etudes"

const e = (id: string, statut = "en_cours") => ({ id, statut })

describe("partitionMesEtudes", () => {
  it("sépare mes études des autres en gardant l'ordre reçu", () => {
    const liste = [e("a"), e("b", "terminee"), e("c"), e("d", "prospection")]
    expect(partitionMesEtudes(liste, ["c", "b"])).toEqual({
      mine: [e("b", "terminee"), e("c")],
      others: [e("a"), e("d", "prospection")],
    })
  })

  it("renvoie tout dans « autres » quand je ne suis sur aucune étude", () => {
    const liste = [e("a"), e("b")]
    expect(partitionMesEtudes(liste, [])).toEqual({ mine: [], others: liste })
  })

  it("ignore les identifiants absents de la liste (étude filtrée par la recherche)", () => {
    expect(partitionMesEtudes([e("a")], ["zzz"])).toEqual({ mine: [], others: [e("a")] })
  })
})

describe("ordonnerPourAccueil", () => {
  it("met les études en cours d'abord et les terminées à la fin, ordre stable sinon", () => {
    const liste = [
      { id: "t", statut: "terminee" },
      { id: "p", statut: "prospection" },
      { id: "c1", statut: "en_cours" },
      { id: "s", statut: "signee" },
      { id: "c2", statut: "en_cours" },
      { id: "x", statut: "statut_inconnu" },
    ]
    expect(ordonnerPourAccueil(liste).map((e) => e.id)).toEqual(["c1", "c2", "s", "p", "x", "t"])
  })
})
