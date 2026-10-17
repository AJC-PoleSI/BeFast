import { describe, it, expect } from "vitest"
import { estDepotDeLaPeriode, regrouperAttente, regrouperDepots, periodeDuDigest, type DocumentLigne } from "./digest"
import { rhDigestEmail } from "./email"

const debut = new Date("2026-10-12T07:00:00Z")
const maintenant = new Date("2026-10-19T07:00:00Z")
const personnes = new Map([
  ["a", { prenom: "Léa", nom: "Martin" }],
  ["b", { prenom: "Noé", nom: "<b>Durand</b>" }],
])
const doc = (o: Partial<DocumentLigne>): DocumentLigne => ({
  personne_id: "a",
  type: "rib",
  status: "pending",
  created_at: "2026-09-10T10:00:00Z",
  updated_at: "2026-09-10T10:00:00Z",
  ...o,
})

describe("estDepotDeLaPeriode", () => {
  it("compte une ligne créée dans la période, quel que soit son statut", () => {
    expect(estDepotDeLaPeriode(doc({ created_at: "2026-10-14T10:00:00Z", status: "approved" }), debut)).toBe(true)
  })
  it("compte un remplacement (ligne pending dont updated_at avance)", () => {
    expect(estDepotDeLaPeriode(doc({ updated_at: "2026-10-15T10:00:00Z" }), debut)).toBe(true)
  })
  it("ne confond pas une validation récente avec un dépôt", () => {
    expect(estDepotDeLaPeriode(doc({ status: "approved", updated_at: "2026-10-15T10:00:00Z" }), debut)).toBe(false)
  })
  it("ignore un dépôt plus ancien", () => {
    expect(estDepotDeLaPeriode(doc({}), debut)).toBe(false)
  })
})

describe("regrouperDepots", () => {
  it("regroupe les pièces par personne avec leurs libellés", () => {
    const r = regrouperDepots(
      [
        doc({ type: "rib", created_at: "2026-10-13T10:00:00Z", updated_at: "2026-10-13T10:00:00Z" }),
        doc({ type: "carte_vitale", created_at: "2026-10-14T10:00:00Z", updated_at: "2026-10-14T10:00:00Z" }),
        doc({ personne_id: "b", created_at: "2026-10-15T10:00:00Z", updated_at: "2026-10-15T10:00:00Z" }),
        doc({}),
      ],
      personnes,
      debut
    )
    expect(r.total).toBe(3)
    expect(r.parPersonne.map((p) => p.personne)).toEqual(["Noé <b>Durand</b>", "Léa Martin"])
    expect(r.parPersonne[1].documents).toEqual(["Carte vitale", "RIB"])
  })
})

describe("regrouperAttente", () => {
  const docs = [
    doc({ personne_id: "a", updated_at: "2026-10-01T07:00:00Z" }),
    doc({ personne_id: "a", type: "carte_vitale", updated_at: "2026-10-10T07:00:00Z" }),
    doc({ personne_id: "b", updated_at: "2026-09-20T07:00:00Z" }),
    doc({ personne_id: "b", type: "rib", status: "approved" }),
  ]
  it("ne retient que les pièces en attente, les plus anciennes d'abord", () => {
    const r = regrouperAttente(docs, personnes, maintenant)
    expect(r.totalDocuments).toBe(3)
    expect(r.totalPersonnes).toBe(2)
    expect(r.liste[0].personne).toContain("Durand")
    expect(r.liste[0].joursAttente).toBe(29)
    expect(r.liste[1]).toMatchObject({ personne: "Léa Martin", nbDocuments: 2, joursAttente: 18 })
  })
  it("plafonne la liste et compte les personnes masquées", () => {
    const r = regrouperAttente(docs, personnes, maintenant, 1)
    expect(r.liste).toHaveLength(1)
    expect(r.masquees).toBe(1)
  })
})

describe("periodeDuDigest", () => {
  it("couvre les 7 derniers jours", () => {
    const p = periodeDuDigest(maintenant)
    expect(p.debut.toISOString()).toBe("2026-10-12T07:00:00.000Z")
  })
})

describe("rhDigestEmail", () => {
  const digest = {
    debut: debut.toISOString(),
    fin: maintenant.toISOString(),
    comptesCrees: { total: 2, personnes: ["Léa Martin", "<script>x</script>"] },
    comptesValides: { total: 0, personnes: [] },
    comptesEnAttente: 5,
    depots: regrouperDepots([doc({ personne_id: "b", created_at: "2026-10-15T10:00:00Z", updated_at: "2026-10-15T10:00:00Z" })], personnes, debut),
    attente: regrouperAttente([doc({ updated_at: "2026-10-01T07:00:00Z" })], personnes, maintenant),
  }
  it("échappe les noms et affiche les compteurs", () => {
    const { subject, html } = rhDigestEmail({ prenom: "Anna", digest, siteUrl: "https://befast.example" })
    expect(subject).toContain("12 octobre")
    expect(html).not.toContain("<script>")
    expect(html).not.toContain("<b>Durand</b>")
    expect(html).toContain("Léa Martin")
    expect(html).toContain("https://befast.example/administration/membres")
    expect(html).toContain("Aucun compte validé cette semaine.")
  })
})
