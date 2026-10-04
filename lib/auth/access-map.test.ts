import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { SURFACES, clesCouvertes, type SurfaceProtegee } from "./access-map"
import { ALL_PERMISSION_KEYS, resolveEffectivePermissions, hasAnyPermission } from "./permissions"
import type { PermissionKey, PersonneWithRole } from "@/types/database.types"
import fixture from "./__fixtures__/roles-ajc.json"

const RACINE = path.resolve(__dirname, "../..")
const lire = (rel: string) => fs.readFileSync(path.join(RACINE, rel), "utf8")

type ProfilFixture = {
  nom: string
  slug: string
  categorie: string
  est_defaut: boolean
  permissions: Record<string, boolean>
}
const PROFILS = fixture.profils as ProfilFixture[]
const parSlug = (slug: string) => PROFILS.find((p) => p.slug === slug)!

/** Fabrique un profil applicatif : un rôle de base + d'éventuels postes. */
function personne(
  baseSlug: string,
  posteSlugs: string[] = [],
  account_status = "validated"
): PersonneWithRole {
  const base = parSlug(baseSlug)
  return {
    id: "u-test",
    account_status,
    profils_types: { slug: base.slug, nom: base.nom, permissions: base.permissions },
    personne_postes: posteSlugs.map((s) => {
      const p = parSlug(s)
      return { profils_types: { slug: p.slug, nom: p.nom, permissions: p.permissions } }
    }),
  } as unknown as PersonneWithRole
}

/** Une surface est ouverte si l'une de ses clés l'est (l'admin passe partout). */
function accede(profil: PersonneWithRole, s: SurfaceProtegee): boolean {
  const estAdmin = profil.profils_types?.slug === "administrateur"
  if (s.adminUniquement) return estAdmin
  if (s.cles.length === 0) return estAdmin
  return hasAnyPermission(profil, s.cles)
}

const surface = (libelle: string) => {
  const s = SURFACES.find((x) => x.libelle === libelle)
  if (!s) throw new Error(`Surface inconnue dans la carte : ${libelle}`)
  return s
}

// ─────────────────────────────────────────────────────────────────────────────
describe("catalogue des permissions", () => {
  it("l'écran Droits propose exactement les clés du catalogue runtime", () => {
    const src = lire("app/(dashboard)/administration/membres/_components/RolesTab.tsx")
    const bloc = src.slice(src.indexOf("const PERM_LABELS"), src.indexOf("const ALL_PERMS"))
    const clesUI = [...bloc.matchAll(/^\s{2}([a-z_]+):\s*\{/gm)].map((m) => m[1])
    expect(clesUI.sort()).toEqual([...ALL_PERMISSION_KEYS].sort())
  })

  it("aucune clé morte : chaque permission ouvre au moins une surface réelle", () => {
    const couvertes = clesCouvertes()
    const mortes = ALL_PERMISSION_KEYS.filter((k) => !couvertes.has(k))
    expect(mortes).toEqual([])
  })

  it("la carte n'invente pas de clé hors catalogue", () => {
    const inconnues = [...clesCouvertes()].filter(
      (k) => !ALL_PERMISSION_KEYS.includes(k as PermissionKey)
    )
    expect(inconnues).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("la carte colle au code", () => {
  it.each(SURFACES.map((s) => [s.libelle, s] as const))(
    "%s — le fichier existe et porte un garde",
    (_libelle, s) => {
      const src = lire(s.fichier)
      if (s.adminUniquement || s.cles.length === 0) {
        expect(
          /requireApiAdmin\(|=== "administrateur"|!== "administrateur"|getCallerRole\(/.test(src)
        ).toBe(true)
        return
      }
      // Au moins une des clés annoncées doit apparaître dans un garde du fichier.
      const trouvee = s.cles.some((k) => {
        const motifs = [
          new RegExp(`requireApiPermission\\("${k}"\\)`),
          new RegExp(`requireApiAnyPermission\\(\\[[^\\]]*"${k}"`, "s"),
          new RegExp(`requireActionPermission\\(\\s*\\[?[^)]*"${k}"`, "s"),
          new RegExp(`hasPermission\\([^,]+,\\s*"${k}"\\)`),
          new RegExp(`hasAnyPermission\\([^,]+,\\s*\\[[^\\]]*"${k}"`, "s"),
          new RegExp(`checkPageAccess\\(\\s*\\[[^\\]]*"${k}"`, "s"),
          new RegExp(`permission="${k}"`),
          new RegExp(`permissions\\?\\.${k}`),
          new RegExp(`has_permission\\(auth\\.uid\\(\\), '${k}'\\)`),
          // Helpers nommés qui encapsulent la clé (voir lib/auth/permissions).
          ...(k === "modifier_etudes" ? [/canEditEtude\(/] : []),
          ...(k === "valider_bv" ? [/requireValiderBV\(/] : []),
        ]
        return motifs.some((re) => re.test(src))
      })
      expect(trouvee, `aucun garde portant ${s.cles.join(" | ")} dans ${s.fichier}`).toBe(true)
    }
  )

  it("chaque entrée de la sidebar correspond à une page réellement gardée", () => {
    const src = lire("components/layout/AppSidebar.tsx")
    const entrees = [...src.matchAll(/href: "([^"]+)",[\s\S]*?permissions: \[([^\]]*)\]/g)].map(
      (m) => ({
        href: m[1],
        cles: [...m[2].matchAll(/"([a-z_]+)"/g)].map((x) => x[1] as PermissionKey),
      })
    )
    expect(entrees.length).toBeGreaterThan(5)
    for (const e of entrees) {
      for (const k of e.cles) expect(ALL_PERMISSION_KEYS).toContain(k)
    }
    // Un lien visible ne doit pas mener à un écran de refus : les clés du lien
    // doivent être incluses dans celles du garde de la page cible.
    const cible: Record<string, string> = {
      "/missions": "Missions",
      "/documents": "Mes documents",
      "/etudes": "Études",
      "/prospection": "Prospection",
      "/tresorerie": "Trésorerie",
      "/statistiques": "Statistiques",
      "/administration": "Espace administration (entrée)",
      "/signatures": "Signatures électroniques",
    }
    for (const [href, libelle] of Object.entries(cible)) {
      const lien = entrees.find((e) => e.href === href)!
      const garde = surface(libelle)
      for (const k of lien.cles) {
        expect(garde.cles, `${href} : le lien s'affiche sur « ${k} » que la page refuse`).toContain(k)
      }
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("matrice des rôles AJC (instantané de la base)", () => {
  const attendu: Record<string, { ouvert: string[]; ferme: string[] }> = {
    administrateur: {
      ouvert: ["Trésorerie", "Espace administration (entrée)", "Export CSV global", "Rôles, postes et permissions (écriture)", "Valider / suspendre un compte"],
      ferme: [],
    },
    membre_ajc: {
      ouvert: ["Études", "Missions", "Mes documents", "Statistiques", "Créer une étude"],
      ferme: ["Trésorerie", "Espace administration (entrée)", "Export CSV global", "Valider / suspendre un compte", "Liste des membres"],
    },
    intervenant: {
      ouvert: ["Missions", "Mes documents", "Mon profil"],
      ferme: ["Études", "Trésorerie", "Statistiques", "Espace administration (entrée)", "Créer une étude", "Liste des membres"],
    },
    candidat: {
      ouvert: ["Mon profil", "Mes documents"],
      ferme: ["Missions", "Études", "Trésorerie", "Espace administration (entrée)", "Statistiques"],
    },
  }

  for (const [slug, { ouvert, ferme }] of Object.entries(attendu)) {
    it(`rôle de base « ${slug} »`, () => {
      const p = personne(slug)
      for (const l of ouvert) expect(accede(p, surface(l)), `${slug} devrait accéder à ${l}`).toBe(true)
      for (const l of ferme) expect(accede(p, surface(l)), `${slug} ne devrait PAS accéder à ${l}`).toBe(false)
    })
  }

  it("Présidente (poste) : trésorerie, administration, signatures", () => {
    const p = personne("membre_ajc", ["presidente"])
    for (const l of [
      "Trésorerie",
      "Espace administration (entrée)",
      "Administration ▸ Paramètres",
      "Administration ▸ Membres & Droits",
      "File de signature du bureau",
      "Enregistrer les paramètres",
    ]) {
      expect(accede(p, surface(l)), `Présidente devrait accéder à ${l}`).toBe(true)
    }
  })

  it("Trésorier·ère (poste) : trésorerie, BV, RIB, signatures — pas les membres", () => {
    const p = personne("membre_ajc", ["tresorier"])
    for (const l of [
      "Trésorerie",
      "Bulletins de versement des intervenants",
      "PDF d'une facture",
      "File de signature du bureau",
      "Déchiffrement des PII d'un autre membre",
    ]) {
      expect(accede(p, surface(l)), `Trésorier·ère devrait accéder à ${l}`).toBe(true)
    }
    expect(accede(p, surface("Administration ▸ Membres & Droits"))).toBe(false)
    expect(accede(p, surface("Export CSV global"))).toBe(false)
  })

  it("Pôle RH (poste) : membres, justificatifs, NSS, candidatures — pas la trésorerie", () => {
    const p = personne("membre_ajc", ["pole_rh"])
    for (const l of [
      "Administration ▸ Membres & Droits",
      "Liste des membres",
      "Justificatifs des membres (liste)",
      "Accepter / refuser une candidature",
      "Déchiffrement des PII d'un autre membre",
      "Fiche d'un autre membre",
    ]) {
      expect(accede(p, surface(l)), `Pôle RH devrait accéder à ${l}`).toBe(true)
    }
    expect(accede(p, surface("Trésorerie"))).toBe(false)
    expect(accede(p, surface("Bulletins de versement des intervenants"))).toBe(false)
  })

  it("changer le rôle d'un membre : Responsable RH oui, Pôle RH et membre AJC non", () => {
    const surf = surface("Changer le rôle de base d'un membre")
    expect(accede(personne("membre_ajc", ["responsable_rh"]), surf)).toBe(true)
    expect(accede(personne("membre_ajc", ["pole_rh"]), surf)).toBe(false)
    expect(accede(personne("membre_ajc"), surf)).toBe(false)
    expect(accede(personne("administrateur"), surf)).toBe(true)
  })

  it("Pôle SI (poste) : publication et édition des études", () => {
    const p = personne("membre_ajc", ["pole_si"])
    expect(accede(p, surface("Publier une étude"))).toBe(true)
    expect(accede(p, surface("Publier une mission"))).toBe(true)
    expect(accede(p, surface("Modifier une étude"))).toBe(true)
    expect(accede(p, surface("Supprimer une étude"))).toBe(true)
    expect(accede(p, surface("Trésorerie"))).toBe(false)
  })

  it("Pôle Marketing (poste) : publication seulement", () => {
    const p = personne("membre_ajc", ["pole_marketing"])
    expect(accede(p, surface("Publier une étude"))).toBe(true)
    expect(accede(p, surface("Modifier une étude"))).toBe(false)
    expect(accede(p, surface("Supprimer une étude"))).toBe(false)
    expect(accede(p, surface("Espace administration (entrée)"))).toBe(false)
  })

  it("Pôle Trésorerie (poste) : trésorerie + membres + paramètres", () => {
    const p = personne("membre_ajc", ["pole_tresorerie"])
    expect(accede(p, surface("Trésorerie"))).toBe(true)
    expect(accede(p, surface("Administration ▸ Paramètres"))).toBe(true)
    expect(accede(p, surface("Fiche d'un autre membre"))).toBe(true)
    expect(accede(p, surface("Export CSV global"))).toBe(false)
  })

  it("les postes sans permission n'ajoutent rien au rôle de base", () => {
    for (const poste of ["vice_presidente", "pole_audit_qualite", "pole_dev_co"]) {
      const seul = resolveEffectivePermissions(personne("membre_ajc"))
      const avec = resolveEffectivePermissions(personne("membre_ajc", [poste]))
      expect(avec, `le poste ${poste} ne porte aucune permission`).toEqual(seul)
    }
  })

  it("le cumul de postes fait bien l'union des droits", () => {
    const p = resolveEffectivePermissions(personne("membre_ajc", ["tresorier", "pole_rh"]))
    expect(p.voir_factures).toBe(true) // trésorier
    expect(p.voir_nss).toBe(true) // pôle RH
    expect(p.etudes).toBe(true) // rôle de base
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("comptes non validés", () => {
  it.each(["pending_validation", "rejected", "deleted"])(
    "un compte « %s » est ramené à son profil et ses documents",
    (statut) => {
      const p = personne("membre_ajc", ["presidente"], statut)
      const perms = resolveEffectivePermissions(p)
      expect(perms.profil).toBe(true)
      expect(perms.documents).toBe(true)
      for (const k of ALL_PERMISSION_KEYS) {
        if (k === "profil" || k === "documents") continue
        expect(perms[k], `${statut} ne doit pas conserver ${k}`).toBe(false)
      }
    }
  )

  it("un administrateur non validé garde ses droits (il valide les comptes)", () => {
    const perms = resolveEffectivePermissions(personne("administrateur", [], "pending_validation"))
    expect(perms.membres).toBe(true)
  })
})
