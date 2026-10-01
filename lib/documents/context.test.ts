import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"

/**
 * Verrous statiques de l'audit du 2026-10-02.
 *
 * `buildTemplateContext` lit la ligne `personnes` de n'importe quel id avec le
 * client admin et en déchiffre les coordonnées (et le NSS sur option). Exportée
 * d'un module `"use server"`, elle était une action appelable par tout compte
 * authentifié. Elle doit rester dans un module server-only, importée par les
 * seules routes qui portent l'autorisation.
 */
const RACINE = path.resolve(__dirname, "..", "..")
const lire = (rel: string) => fs.readFileSync(path.join(RACINE, rel), "utf8")

describe("contexte des documents — jamais une server action", () => {
  it("lib/documents/context.ts est server-only et n'est pas un module use server", () => {
    const src = lire("lib/documents/context.ts")
    expect(src.startsWith('import "server-only"')).toBe(true)
    expect(src).not.toMatch(/^\s*"use server"/m)
    expect(src).toMatch(/export async function buildTemplateContext\(/)
  })

  it("lib/actions/documents.ts n'exporte plus les constructeurs de contexte", () => {
    const src = lire("lib/actions/documents.ts")
    expect(src).not.toMatch(/buildTemplateContext|buildFactureContext/)
  })

  it("le scope « personne » (ligne brute de n'importe quel id) n'existe plus", () => {
    const src = lire("lib/documents/context.ts")
    expect(src).not.toMatch(/scope === "personne"/)
    expect(lire("app/api/documents/generate/route.ts")).toMatch(/\["etude", "mission", "general", "facture"\]\.includes\(scope\)/)
  })

  it("un intervenant explicite est rattaché à la mission avant toute lecture", () => {
    const src = lire("lib/documents/context.ts")
    expect(src).toMatch(/estIntervenantDeLaMission\(entityId, intervenantId\)/)
    expect(src).toMatch(/estIntervenantDeLEtude\(entityId, intervenantId\)/)
    expect(lire("app/api/documents/generate/route.ts")).toMatch(/estIntervenantDeLaMission\(entity_id, intervenant_id\)/)
  })

  it("seules des routes serveur importent le contexte", () => {
    const importeurs: string[] = []
    const marcher = (dir: string) => {
      for (const entree of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entree.name === "node_modules" || entree.name.startsWith(".")) continue
        const chemin = path.join(dir, entree.name)
        if (entree.isDirectory()) marcher(chemin)
        else if (/\.(ts|tsx)$/.test(entree.name) && !/\.test\.tsx?$/.test(entree.name) && fs.readFileSync(chemin, "utf8").includes('@/lib/documents/context"')) {
          importeurs.push(path.relative(RACINE, chemin))
        }
      }
    }
    for (const d of ["app", "lib", "components"]) marcher(path.join(RACINE, d))
    for (const f of importeurs) {
      expect(f, `${f} importe le contexte : seul un route handler serveur y est autorisé`).toMatch(/^app\/api\/.*\/route\.ts$/)
    }
  })
})
