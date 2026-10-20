import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { CLASSES_MISSION, normaliserClasse } from "./classe"
import { SCOLARITES } from "../../app/(dashboard)/dashboard/profil/_lib/schemas"

describe("normaliserClasse", () => {
  // Bug prod 20/10/2026 : "Master 1" (scolarité du profil) était envoyé tel
  // quel en minuscules ("master 1") et violait candidatures_classe_check.
  it("traduit chaque scolarité du profil vers une classe acceptée par la base", () => {
    for (const s of SCOLARITES) {
      const c = normaliserClasse(s)
      expect(c, s).not.toBeNull()
      expect(CLASSES_MISSION).toContain(c)
    }
    expect(normaliserClasse("Pré-Master")).toBe("premaster")
    expect(normaliserClasse("Master 1")).toBe("m1")
    expect(normaliserClasse("Master 2")).toBe("m2")
  })

  it("accepte les codes déjà normalisés et les niveaux de propale", () => {
    expect(normaliserClasse("premaster")).toBe("premaster")
    expect(normaliserClasse("m1")).toBe("m1")
    expect(normaliserClasse("M2")).toBe("m2")
    expect(normaliserClasse("L3")).toBe("premaster")
  })

  it("tolère les variantes de saisie (accents, espaces, tirets, casse)", () => {
    expect(normaliserClasse("Prémaster")).toBe("premaster")
    expect(normaliserClasse("pre-master")).toBe("premaster")
    expect(normaliserClasse(" PRE MASTER ")).toBe("premaster")
    expect(normaliserClasse("master1")).toBe("m1")
    expect(normaliserClasse("Master-2")).toBe("m2")
  })

  it("renvoie null pour une valeur vide ou inconnue plutôt que de faire échouer l'insert", () => {
    expect(normaliserClasse(null)).toBeNull()
    expect(normaliserClasse(undefined)).toBeNull()
    expect(normaliserClasse("")).toBeNull()
    expect(normaliserClasse("Bachelor 3")).toBeNull()
    expect(normaliserClasse("MBA")).toBeNull()
  })
})

describe("CLASSES_MISSION ↔ contraintes SQL", () => {
  // Si une migration élargit/modifie la liste, ce test force à mettre le
  // helper à jour (et inversement).
  it("correspond exactement aux CHECK classe de missions et candidatures", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/005_clients_etudes_missions.sql"),
      "utf8"
    )
    const checks = [...sql.matchAll(/classe\s+TEXT CHECK \(classe IN \(([^)]*)\)\)/g)]
    expect(checks).toHaveLength(2)
    for (const [, liste] of checks) {
      const valeurs = liste.split(",").map((v) => v.trim().replace(/'/g, ""))
      expect([...valeurs].sort()).toEqual([...CLASSES_MISSION].sort())
    }
  })
})
